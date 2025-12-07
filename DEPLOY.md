# Деплой на GitHub Pages

## Автоматический деплой (рекомендуется)

1. **Включи GitHub Pages в настройках репозитория:**
   - Зайди в Settings → Pages
   - Source: выбери "GitHub Actions"

2. **Запуш код:**
   ```bash
   git add .
   git commit -m "Add game and CI/CD"
   git push origin main
   ```

3. **Готово!** Игра будет доступна по адресу:
   `https://babang1da.github.io/cheburek-game/`

## Ручной деплой

```bash
# Собрать проект
npm run build

# Содержимое папки dist/ загрузить на GitHub Pages
```

## Проверка

После деплоя открой:
https://babang1da.github.io/cheburek-game/

Если не работает - проверь:
1. Settings → Pages → Source = "GitHub Actions"
2. Actions → Deploy to GitHub Pages (должен быть зелёный ✓)
