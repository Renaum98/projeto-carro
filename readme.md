# 🚗 CarE — Controle de Manutenção Veicular

## Estrutura de arquivos

```
autocare/
├── index.html                  ← HTML principal
├── styles/
│   ├── main.css                ← Variáveis, reset e base
│   ├── layout.css              ← Header, grid, stats, responsivo
│   └── components.css          ← Cards, form, botões, modal, toast
└── scripts/
    ├── firebase-config.js      ← ⚠️ Suas credenciais Firebase (edite aqui)
    ├── data.js                 ← Tipos de serviço, validades e ícones
    ├── utils.js                ← Funções auxiliares (toast, loader, datas)
    ├── auth.js                 ← Autenticação Google
    ├── db.js                   ← Operações Firestore + Storage
    ├── ui.js                   ← Funções de renderização da interface
    └── app.js                  ← Controller principal
```

---

## ⚙️ Configuração do Firebase

### 1. Crie o projeto (se ainda não tiver)

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Crie um novo projeto
3. Adicione um app Web (ícone `</>`)
4. Copie o objeto `firebaseConfig`

### 2. Cole as credenciais

Abra `scripts/firebase-config.js` e substitua os valores:

```js
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO_ID",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID",
};
```

### 3. Ative os serviços no console Firebase

| Serviço            | Caminho no console                       | O que ativar  |
| ------------------ | ---------------------------------------- | ------------- |
| **Authentication** | Build → Authentication → Sign-in method  | Google        |
| **Firestore**      | Build → Firestore Database → Criar banco | Modo produção |
| **Storage**        | Build → Storage → Começar                | Modo produção |

### 4. Regras do Firestore

Em **Firestore → Regras**, cole:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/vehicles/{vehicleId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /records/{recordId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

> Storage não é necessário — as fotos são salvas como base64 comprimido direto no Firestore.

### 6. Domínio autorizado (se usar hospedagem própria)

Em **Authentication → Settings → Authorized domains**, adicione seu domínio.

---

## 🚀 Como rodar localmente

Como o projeto usa **ES Modules**, ele precisa de um servidor HTTP.
Não funciona abrindo o `index.html` direto no navegador.

**Opção 1 — VS Code Live Server**
Instale a extensão [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) e clique em "Go Live".

**Opção 2 — Python**

```bash
python3 -m http.server 8080
# Acesse: http://localhost:8080
```

**Opção 3 — Node.js**

```bash
npx serve .
```

---

## 📦 Funcionalidades

- ✅ Login com Google (dados isolados por usuário)
- ✅ 16 tipos de manutenção com validades médias automáticas
- ✅ Auto-preenchimento da próxima data/KM
- ✅ Upload de foto do comprovante (Firebase Storage)
- ✅ Alertas visuais: vencido 🔴 / a vencer 🟡 / em dia 🟢
- ✅ Filtros por status
- ✅ Exportar backup em JSON
- ✅ Dados salvos no Firestore em tempo real
