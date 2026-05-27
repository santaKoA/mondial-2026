#!/bin/bash
set -e
cd "$(dirname "$0")"

# ── Colors ──
G='\033[0;32m'; Y='\033[1;33m'; C='\033[0;36m'; R='\033[0;31m'; B='\033[1m'; N='\033[0m'
ok()   { echo -e "${G}✓ $1${N}"; }
warn() { echo -e "${Y}⚠ $1${N}"; }
step() { echo -e "\n${C}${B}── $1 ──${N}"; }
die()  { echo -e "${R}✗ $1${N}"; exit 1; }

echo -e "${G}${B}"
echo "  ⚽  מונדיאל 2026 — Deploy Script"
echo -e "${N}"

# ════════════════════════════════════════
# שלב 1: .env
# ════════════════════════════════════════
step "שלב 1/5 · הכנת .env"

if [ ! -f .env ]; then
    SECRET=$(openssl rand -hex 32)
    ADMIN=$(openssl rand -hex 6)
    cat > .env <<EOF
GROUP_CODE=mondial2026
ADMIN_CODE=$ADMIN
SECRET_KEY=$SECRET
TOURNAMENT_START=2026-06-11T17:00:00
DATABASE_URL=sqlite:////app/data/mondial.db
EOF
    ok "קובץ .env נוצר"
    echo ""
    echo -e "${B}🔑 שמור את הפרטים האלה במקום בטוח:${N}"
    echo -e "   ADMIN_CODE = ${C}$ADMIN${N}  ← הקוד שלך לפאנל ניהול"
    echo -e "   SECRET_KEY = $SECRET"
else
    ok "קובץ .env קיים"
fi

source .env

# ════════════════════════════════════════
# שלב 2: GitHub
# ════════════════════════════════════════
step "שלב 2/5 · GitHub"

if ! git remote get-url origin &>/dev/null; then
    echo ""
    read -p "  שם משתמש ב-GitHub: " GH_USER
    read -p "  שם ה-repo (ברירת מחדל: mondial-2026): " GH_REPO
    GH_REPO="${GH_REPO:-mondial-2026}"

    echo ""
    echo -e "${Y}  עכשיו צור repo חדש ב-GitHub:${N}"
    echo -e "  ← https://github.com/new"
    echo "     שם: $GH_REPO | Private | בלי README"
    echo ""
    read -p "  לחץ Enter אחרי שיצרת את ה-repo..."

    git remote add origin "https://github.com/$GH_USER/$GH_REPO.git"
fi

git add -A && git diff --staged --quiet || git commit -m "Deploy preparation" --quiet 2>/dev/null || true
git push -u origin main 2>/dev/null || git push origin main
ok "קוד עלה ל-GitHub"

# ════════════════════════════════════════
# שלב 3: Railway CLI
# ════════════════════════════════════════
step "שלב 3/5 · Railway CLI"

if ! command -v railway &>/dev/null; then
    echo "  מתקין Railway CLI..."
    curl -fsSL https://railway.app/install.sh | sh
    export PATH="$HOME/.railway/bin:$HOME/.local/share/railway/bin:$PATH"
fi

RAILWAY_VERSION=$(railway --version 2>/dev/null | head -1 || echo "?")
ok "Railway CLI: $RAILWAY_VERSION"

echo ""
echo -e "  ${Y}מתחבר ל-Railway (יפתח דפדפן):${N}"
railway login || die "ההתחברות נכשלה"
ok "מחובר"

# ════════════════════════════════════════
# שלב 4: Backend
# ════════════════════════════════════════
step "שלב 4/5 · Deploy Backend"

railway init --name "mondial-2026" 2>/dev/null || true

echo "  מעלה backend..."
(cd backend && railway up --service backend --detach 2>/dev/null || railway up --detach)
ok "Backend בתהליך deploy"

echo "  מגדיר משתני סביבה..."
(cd backend && railway variables set \
    ADMIN_CODE="$ADMIN_CODE" \
    SECRET_KEY="$SECRET_KEY" \
    TOURNAMENT_START="$TOURNAMENT_START" \
    DATABASE_URL="sqlite:////app/data/mondial.db" \
    2>/dev/null || true)
ok "משתנים הוגדרו"

echo ""
echo -e "${Y}${B}  ⚠ צעד ידני נדרש — Volume לשמירת נתונים:${N}"
echo "  1. פתח: https://railway.app/dashboard"
echo "  2. פרויקט mondial-2026 → שירות backend"
echo "  3. לשונית Volumes → + Add Volume"
echo "  4. Mount path: /app/data → Add"
echo ""
read -p "  לחץ Enter אחרי שהוספת Volume..."

echo ""
echo "  מייצר דומיין ל-backend..."
BACKEND_URL=$(cd backend && railway domain generate 2>/dev/null | grep -oE 'https://[^ ]+' | head -1 || echo "")

if [ -z "$BACKEND_URL" ]; then
    warn "לא הצלחתי לקבל את ה-URL אוטומטית"
    echo ""
    echo "  מצא אותו ב: Railway Dashboard → backend → Settings → Networking"
    read -p "  הדבק כאן את ה-URL של ה-backend: " BACKEND_URL
fi

# וודא שהURL כולל https://
[[ "$BACKEND_URL" != https://* ]] && BACKEND_URL="https://$BACKEND_URL"
# הסר / מהסוף
BACKEND_URL="${BACKEND_URL%/}"

ok "Backend URL: ${C}$BACKEND_URL${N}"

# ════════════════════════════════════════
# שלב 5: Frontend
# ════════════════════════════════════════
step "שלב 5/5 · Deploy Frontend"

echo "  מעלה frontend..."
(cd frontend && railway up --service frontend --detach 2>/dev/null || railway up --detach)

echo "  מגדיר VITE_API_URL..."
(cd frontend && railway variables set VITE_API_URL="$BACKEND_URL" 2>/dev/null || true)
ok "Frontend בתהליך deploy (build ~2 דקות)"

echo "  מייצר דומיין ל-frontend..."
FRONTEND_URL=$(cd frontend && railway domain generate 2>/dev/null | grep -oE 'https://[^ ]+' | head -1 || echo "")

if [ -z "$FRONTEND_URL" ]; then
    warn "לא הצלחתי לקבל URL — בדוק ב-Railway Dashboard"
    read -p "  הדבק כאן את ה-URL של ה-frontend (אפשר לדלג - Enter): " FRONTEND_URL
fi

[[ "$FRONTEND_URL" != https://* ]] && [ -n "$FRONTEND_URL" ] && FRONTEND_URL="https://$FRONTEND_URL"

# ════════════════════════════════════════
# סיום
# ════════════════════════════════════════
echo ""
echo -e "${G}${B}═══════════════════════════════════════════${N}"
echo -e "${G}${B}  ✅  הדפלוי הושלם!${N}"
echo -e "${G}${B}═══════════════════════════════════════════${N}"
echo ""
if [ -n "$FRONTEND_URL" ]; then
    echo -e "  🌐 ${B}שלח לחברים:${N}"
    echo -e "     ${C}${B}$FRONTEND_URL${N}"
else
    echo -e "  🌐 מצא את ה-URL ב-Railway Dashboard → frontend → Settings → Networking"
fi
echo ""
echo -e "  🔑 ${B}קוד אדמין שלך:${N} ${Y}$ADMIN_CODE${N}"
echo "     (כנס עם השם שלך + קוד זה לפאנל הניהול)"
echo ""
echo -e "  📋 ${B}לעדכוני קוד עתידיים:${N}"
echo "     git push origin main"
echo "     Railway יעשה redeploy אוטומטית"
echo ""
