# 🚀 GUIA SUPER SIMPLES - FestaMais Backend

## PASSO 1: Criar Pasta (2 minutos)

### NO WINDOWS:
1. Abra **Explorador de Arquivos** (ícone de pasta)
2. Clique em **Este Computador** → **C:**
3. Clique direito → **Nova Pasta**
4. Nome: `festamais-backend`
5. Abra a pasta (double click)

### NO MAC/LINUX:
Abra o Terminal e copie/cole isto:
```
mkdir ~/festamais-backend
cd ~/festamais-backend
```

---

## PASSO 2: Criar Arquivos (5 minutos)

Na pasta `festamais-backend`, você precisa criar os seguintes arquivos:

### 1️⃣ **package.json**
- Clique direito → Novo → Arquivo de texto
- Coloque o nome: `package.json` (IMPORTANTE: é .json, não .txt)
- Abra com bloco de notas
- **COLE TODO O CONTEÚDO ABAIXO:**

```json
{
  "name": "festamais-backend",
  "version": "1.0.0",
  "description": "Backend SaaS para gestão de aluguel de itens para festas",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "keywords": ["saas", "aluguel", "festa", "estoque"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "pg": "^8.8.0",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "joi": "^17.7.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.20"
  }
}
```

Salve e feche.

### 2️⃣ **.env** (Arquivo de configuração)
- Novo arquivo de texto
- Nome: `.env` (IMPORTANTE: começa com ponto)
- COLE ISTO:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/festamais
DB_HOST=localhost
DB_PORT=5432
DB_NAME=festamais
DB_USER=postgres
DB_PASSWORD=password

JWT_SECRET=sua_chave_secreta_super_segura_123456789

NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

Salve e feche.

---

## PASSO 3: Instalar Dependências (3 minutos)

### NO WINDOWS:
1. Na pasta `festamais-backend`, clique direito no espaço vazio
2. Selecione: **Abrir PowerShell aqui** ou **Abrir Terminal aqui**
3. Cole isto:
```
npm install
```

### NO MAC/LINUX:
```
cd ~/festamais-backend
npm install
```

**Espere terminar!** Vai demorar ~2 minutos. Você verá muitas linhas.

Quando terminar, aparecerá:
```
added XXX packages
```

✅ **Pronto!**

---

## PASSO 4: Criar Banco de Dados (5 minutos)

### NO WINDOWS:
1. Procure por **pgAdmin** (instalado com PostgreSQL)
2. Abra pgAdmin
3. Clique em **Servers** → **PostgreSQL**
4. Clique direito em **Databases** → **Create** → **Database**
5. Nome: `festamais`
6. Clique **Save**

### NO MAC/LINUX:
Cole isto no Terminal:
```
psql -U postgres -c "CREATE DATABASE festamais;"
```

✅ **Pronto!**

---

## PASSO 5: Criar Tabelas no Banco (5 minutos)

### NO WINDOWS (pgAdmin):
1. Abra pgAdmin
2. Clique em **Databases** → **festamais**
3. Clique em **Query Tool** (ícone de SQL)
4. **COLE TODO O SQL ABAIXO** (você vai receber um arquivo SQL)
5. Clique **Execute**

### NO MAC/LINUX:
Cole isto no Terminal:
```
psql -U postgres -d festamais < scripts/schema.sql
```

---

## PASSO 6: Testar se tá funcionando! (2 minutos)

Na pasta `festamais-backend`, abra o terminal e cole:

```
npm run dev
```

Se aparecer isto, deu certo! ✅
```
🚀 FestaMais Backend rodando em porta 3000
📡 Ambiente: development
🔗 API: http://localhost:3000
```

---

## ❌ DEU ERRO? (Não se preocupe!)

### Erro: "npm not found"
- Node.js não foi instalado corretamente
- Reinstale em: https://nodejs.org (versão LTS)
- Reinicie o computador após instalar

### Erro: "Cannot find module"
- As dependências não instalaram
- Tente novamente: `npm install`
- Se continuar, delete a pasta `node_modules` e tente de novo

### Erro: "PostgreSQL connection refused"
- PostgreSQL não está rodando
- **Windows:** Procure por "PostgreSQL" no início do Windows e veja se está rodando
- **Mac:** `brew services start postgresql`
- **Linux:** `sudo service postgresql start`

---

## ✅ CHECKLIST FINAL

Você deve ter:
- [ ] Pasta `festamais-backend` criada
- [ ] Arquivo `package.json` dentro dela
- [ ] Arquivo `.env` dentro dela
- [ ] `npm install` executado com sucesso
- [ ] Banco `festamais` criado no PostgreSQL
- [ ] `npm run dev` rodando sem erros

Se tudo isto passar, você tem um **backend funcional!** 🎉

---

## 🎯 PRÓXIMO PASSO

Depois que tudo estiver rodando, você cria os outros arquivos:
- `server.js`
- `config/database.js`
- `middleware/auth.js`
- E assim por diante...

**MAS PRIMEIRO, garanta que esses 6 passos funcionam!**

Quando conseguir fazer `npm run dev` sem erros, avise que a gente continua! 💪

---

**Qualquer dúvida, é só chamar!** 🚀
