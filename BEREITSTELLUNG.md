# Mantodeus Manager - Dauerhafte Bereitstellung

## ✅ Status

Ihr Projekt wurde erfolgreich zu GitHub gepusht:
- **Repository**: https://github.com/mantodeus/mantodeus-manager
- **Branch**: main
- **Sichtbarkeit**: Privat

## 🚀 Optionen für dauerhafte Bereitstellung

### Option 1: Railway (Empfohlen - Am einfachsten)

Railway bietet kostenloses Hosting mit automatischer Bereitstellung:

#### Schritte:

1. **Gehen Sie zu Railway**: https://railway.app
2. **Registrieren Sie sich** mit Ihrem GitHub-Konto
3. **Neues Projekt erstellen**:
   - Klicken Sie auf "New Project"
   - Wählen Sie "Deploy from GitHub repo"
   - Wählen Sie `mantodeus/mantodeus-manager`
4. **MySQL-Datenbank hinzufügen**:
   - Klicken Sie auf "+ New"
   - Wählen Sie "Database" → "Add MySQL"
5. **Umgebungsvariablen konfigurieren**:
   ```
   NODE_ENV=production
   PORT=3000
   JWT_SECRET=[generiert automatisch]
   VITE_SUPABASE_URL=https://ihr-projekt.supabase.co
   VITE_SUPABASE_ANON_KEY=[Supabase Anon Key]
   SUPABASE_SERVICE_ROLE_KEY=[Supabase Service Role Key]
   OWNER_SUPABASE_ID=[Owner Supabase UUID]
   VITE_APP_TITLE=Mantodeus Manager
   VITE_APP_LOGO=/mantodeus-logo.png
   ```
6. **Bereitstellen**: Railway baut und startet automatisch

**Kosten**: $5/Monat (500 Stunden kostenlos für neue Nutzer)

---

### Option 2: Render (Kostenlose Option)

Render bietet kostenloses Hosting mit einigen Einschränkungen:

#### Schritte:

1. **Gehen Sie zu Render**: https://render.com
2. **Registrieren Sie sich** mit Ihrem GitHub-Konto
3. **Neuen Web Service erstellen**:
   - Klicken Sie auf "New +"
   - Wählen Sie "Web Service"
   - Verbinden Sie Ihr GitHub-Repository
   - Wählen Sie `mantodeus/mantodeus-manager`
4. **Konfiguration**:
   - **Name**: mantodeus-manager
   - **Region**: Frankfurt
   - **Branch**: main
   - **Build Command**: `pnpm install && pnpm build`
   - **Start Command**: `pnpm start`
5. **MySQL-Datenbank hinzufügen**:
   - Gehen Sie zu Dashboard
   - Klicken Sie auf "New +"
   - Wählen Sie "PostgreSQL" (MySQL nicht kostenlos verfügbar)
   - Oder verwenden Sie externe MySQL-Datenbank (siehe unten)
6. **Umgebungsvariablen hinzufügen** (wie bei Railway)
7. **Bereitstellen**: Render baut und startet automatisch

**Kosten**: Kostenlos (mit Einschränkungen: schläft nach 15 Min Inaktivität)

---

### Option 3: Vercel + PlanetScale (Moderne Lösung)

Vercel für Frontend, PlanetScale für Datenbank:

#### Schritte:

1. **PlanetScale-Datenbank erstellen**:
   - Gehen Sie zu https://planetscale.com
   - Registrieren Sie sich
   - Erstellen Sie neue Datenbank: `mantodeus-manager`
   - Kopieren Sie die Verbindungs-URL

2. **Vercel-Bereitstellung**:
   - Gehen Sie zu https://vercel.com
   - Registrieren Sie sich mit GitHub
   - Klicken Sie auf "Add New" → "Project"
   - Importieren Sie `mantodeus/mantodeus-manager`
   - Konfigurieren Sie Umgebungsvariablen
   - Bereitstellen

**Kosten**: Kostenlos für Hobby-Projekte

---

### Option 4: Docker + Eigener Server

Wenn Sie einen eigenen Server (VPS) haben:

#### Schritte:

1. **Server vorbereiten**:
   ```bash
   # SSH zum Server
   ssh user@ihr-server.de
   
   # Docker installieren
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

2. **Repository klonen**:
   ```bash
   git clone https://github.com/mantodeus/mantodeus-manager.git
   cd mantodeus-manager
   ```

3. **.env-Datei erstellen**:
   ```bash
   cp .env.example .env
   nano .env  # Konfigurieren Sie Ihre Werte
   ```

4. **Mit Docker Compose starten**:
   ```bash
   docker-compose up -d
   ```

5. **Nginx als Reverse Proxy** (optional):
   ```nginx
   server {
       listen 80;
       server_name ihre-domain.de;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
       }
   }
   ```

6. **SSL mit Let's Encrypt**:
   ```bash
   sudo certbot --nginx -d ihre-domain.de
   ```

**Kosten**: VPS-Kosten (ab €5/Monat bei Hetzner, DigitalOcean, etc.)

---

## 🔧 Externe MySQL-Datenbank

Falls Sie eine externe MySQL-Datenbank benötigen:

### Kostenlose Optionen:
- **FreeMySQLHosting**: https://www.freemysqlhosting.net (5 MB)
- **db4free**: https://www.db4free.net (200 MB)

### Bezahlte Optionen:
- **PlanetScale**: $29/Monat (MySQL-kompatibel)
- **AWS RDS**: Ab $15/Monat
- **DigitalOcean Managed Database**: $15/Monat

---

## 📝 Benötigte Umgebungsvariablen

Für alle Bereitstellungsoptionen benötigen Sie:

```env
# Pflicht
DATABASE_URL=mysql://user:password@host:3306/database
JWT_SECRET=ein_zufälliger_geheimer_schlüssel
VITE_SUPABASE_URL=https://ihr-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=ihr_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=ihr_service_role_key
OWNER_SUPABASE_ID=owner_supabase_uuid

# Optional (aber empfohlen)
S3_ENDPOINT=ihr_s3_endpoint
S3_BUCKET=ihr_bucket_name
S3_ACCESS_KEY_ID=ihr_access_key
S3_SECRET_ACCESS_KEY=ihr_secret_key
```

---

## 🎯 Empfehlung

Für den schnellsten Start empfehle ich **Railway**:

1. ✅ Einfachste Einrichtung
2. ✅ Automatische MySQL-Datenbank
3. ✅ Automatische SSL-Zertifikate
4. ✅ Automatische Bereitstellung bei Git-Push
5. ✅ Gute kostenlose Testphase

**Nächste Schritte**:
1. Gehen Sie zu https://railway.app
2. Registrieren Sie sich mit GitHub
3. Folgen Sie den Schritten unter "Option 1: Railway"
4. Ihre App wird in 5-10 Minuten live sein!

---

## 🆘 Hilfe benötigt?

Falls Sie Hilfe bei der Bereitstellung benötigen:
1. Wählen Sie eine der Optionen oben
2. Folgen Sie den Schritten
3. Bei Problemen: Öffnen Sie ein Issue auf GitHub

---

**Viel Erfolg mit Ihrer Bereitstellung!** 🚀
