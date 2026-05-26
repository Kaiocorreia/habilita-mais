# Habilita+

Marketplace digital para democratização do acesso à Carteira Nacional de Habilitação (CNH).

## Domínio

Conecta **candidatos** à CNH com **instrutores** e **autoescolas**, oferecendo:
- Busca por localização, categoria, preço e avaliação
- Filtro para aulas somente com mulheres (`gender=F`)
- Filtro de acessibilidade (`isAccessible=true`)
- Sistema de agendamento estruturado
- Ranqueamento por avaliações (1–5 estrelas)
- Autenticação JWT + controle de papéis (CANDIDATE, PROFESSIONAL, ADMIN)

## Entidades

| Modelo | Descrição |
|---|---|
| `User` | Candidatos, Profissionais e Admins |
| `Professional` | Perfil do instrutor/autoescola vinculado a um User |
| `Appointment` | Agendamento entre Candidato e Profissional |
| `Review` | Avaliação após agendamento concluído |

## Instalação

```bash
npm install
cp .env.example .env
# Edite .env com seu JWT_SECRET
npx prisma migrate dev
```

## Executar

```bash
npm run dev
```

Servidor em `http://localhost:3000`.

## Testes

```bash
npm run test:run          # execução única
npm run test:coverage     # com relatório de cobertura
```

## Variáveis de ambiente (.env.example)

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="sua-chave-secreta-longa-e-aleatoria-aqui"
JWT_EXPIRES_IN="1d"
```

## Endpoints principais

### Autenticação (público)
```http
POST /auth/register     { email, name?, password, role? }
POST /auth/login        { email, password }
GET  /auth/me           # requer token
```

### Profissionais (requer token)
```http
GET    /professionals?location=&womenOnly=true&isAccessible=true&category=B
GET    /professionals/:id
POST   /professionals             # role=PROFESSIONAL
PUT    /professionals/:id         # dono ou ADMIN
PATCH  /professionals/:id/verify  # ADMIN only
DELETE /professionals/:id         # ADMIN only
```

### Agendamentos (requer token)
```http
POST   /appointments              # role=CANDIDATE
GET    /appointments
GET    /appointments/:id
PATCH  /appointments/:id/status   { status: CONFIRMED|CANCELLED|COMPLETED }
DELETE /appointments/:id
```

### Avaliações (requer token)
```http
POST /reviews                          { appointmentId, rating (1-5), comment? }
GET  /reviews
GET  /reviews/professional/:id
GET  /reviews/:id
PUT  /reviews/:id                      # autor only
DELETE /reviews/:id                    # autor ou ADMIN
```

### Usuários (requer token)
```http
GET    /users              # ADMIN only
GET    /users/:id          # próprio ou ADMIN
PUT    /users/:id          # próprio ou ADMIN
PATCH  /users/:id/promote  # ADMIN only
DELETE /users/:id          # ADMIN only
```

## Exemplo de fluxo (curl)

```bash
# 1. Registrar candidato
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"maria@test.com","name":"Maria","password":"senha123"}'

# 2. Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"maria@test.com","password":"senha123"}' | jq -r '.token')

# 3. Buscar profissionais com filtro de instrutoras mulheres
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/professionals?womenOnly=true&location=Vitória"

# 4. Criar agendamento
curl -X POST http://localhost:3000/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"professionalId":1,"serviceType":"Aula prática","scheduledAt":"2026-06-10T09:00:00.000Z"}'
```

## Visualizar banco
```bash
npx prisma studio
```

## Tecnologias
- Node.js + TypeScript (ES Modules)
- Express.js
- Prisma ORM (SQLite)
- JWT (jsonwebtoken) + bcrypt
- Zod (validação)
- Vitest + Supertest (testes)

**Prof. Otávio Lube — Desenvolvimento de Aplicações Web II — Unidade 3**
