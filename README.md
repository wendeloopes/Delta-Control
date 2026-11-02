# Delta Control — MVP Expo

Aplicativo mobile de controle financeiro pessoal, feito com React Native e Expo, com interface escura e persistência local.

## Estado do projeto
Este repositório contém o MVP inicial. A versão atual oferece:
- Painel de saldo e resumo de entradas/saídas.
- Quatro abas: Início, Movimentações, Estatísticas e Configurações.
- Cadastro rápido de movimentações por comando digitado.
- Persistência local usando AsyncStorage.
- Tema escuro.

## Requisitos
- Node.js LTS
- Expo Go no celular
- Computador e celular na mesma rede Wi-Fi (ou usar túnel)

## Executar
```bash
npm install
npx expo start
```
Depois, escaneie o QR code pelo Expo Go. Se necessário, execute `npx expo start --tunnel`.

## Exemplos de comandos
- `entrada 150 venda`
- `recebi 250 salário`
- `saída 29,90 almoço`
- `gastei 25 café`
- `paguei 120 internet`

**Importante:** o botão de comando abre entrada por texto. Reconhecimento de voz real ainda não está implementado e será uma etapa posterior.

## Limitações conhecidas do MVP
- Os dados ficam apenas no dispositivo; não há sincronização com nuvem ou bancos.
- A primeira execução cria movimentações demonstrativas.
- Não é um sistema financeiro conectado a instituições bancárias.

## Próximos passos
1. Instalar dependências e validar build/typecheck.
2. Corrigir eventuais incompatibilidades de versões.
3. Implementar testes e validação dos comandos.
4. Planejar exportação, autenticação e backup, caso sejam necessários.

## Ícone do aplicativo
O ícone Android está configurado em `app.json` e utiliza `assets/images/icon.png`.


## WhatsApp Cloud API (Meta)

The webhook endpoint is `POST /api/webhook` and also handles Meta's GET subscription challenge. Configure the Meta App webhook callback URL to the deployed Vercel URL plus `/api/webhook`, and subscribe the WhatsApp Business Account to `messages`. For a number onboarded through WhatsApp Business App Coexistence, also subscribe to `smb_message_echoes`; this event mirrors messages sent from the WhatsApp Business App into the webhook, allowing the owner to send commands from the same connected number without a second phone number.

Required server-side Vercel environment variables (Preview first):

- `META_APP_SECRET`: Meta App Secret, used only to validate `X-Hub-Signature-256`.
- `WHATSAPP_VERIFY_TOKEN`: private random string configured identically in Meta's webhook verification screen and Vercel.
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or the corresponding `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) for the Redis queue.
- `WHATSAPP_PHONE_NUMBER_ID` (recommended): the connected Meta phone-number ID used to reject events for other numbers.

Do not put Meta App Secret, verify token, or Redis credentials in the mobile app or any `EXPO_PUBLIC_*` variable. The webhook verifies the raw request body with HMAC-SHA256 before parsing messages and deduplicates message IDs. The app receives queued movements through the authenticated device-sync endpoint.

**Same-number requirement:** receiving a message sent from the connected WhatsApp Business App requires the number to be onboarded in Meta's Coexistence mode (Business App + Cloud API) and the `smb_message_echoes` webhook field to be enabled. A number connected in API-only mode cannot produce app-originated echo events. No second phone number is needed when Coexistence is active; the app can send a command from its existing Business App chat, including a self-chat if WhatsApp delivers that message as an echo.
