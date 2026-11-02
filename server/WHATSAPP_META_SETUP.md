# WhatsApp Cloud API — ambiente de teste do Delta Control

Este endpoint é separado do webhook legado da Evolution API. Ele foi preparado para receber eventos da Meta Cloud API e responder ao número autorizado.

## Endpoint

- Callback URL: `https://SEU-DOMINIO/api/whatsapp/webhook`
- Verify token: valor aleatório definido por você em `WHATSAPP_VERIFY_TOKEN`
- Assinatura: o POST valida `X-Hub-Signature-256` usando `WHATSAPP_APP_SECRET`.
- O endpoint aceita somente o número definido em `WHATSAPP_ALLOWED_NUMBER`.

## Variáveis de ambiente na Vercel

Configure todas no ambiente Production (e Preview se for testar preview):

- `WHATSAPP_VERIFY_TOKEN`: segredo aleatório usado somente no desafio GET do webhook.
- `WHATSAPP_APP_SECRET`: App Secret do aplicativo Meta; nunca coloque no APK.
- `WHATSAPP_ACCESS_TOKEN`: token de acesso da Cloud API; nunca coloque no APK.
- `WHATSAPP_PHONE_NUMBER_ID`: Phone Number ID do número de teste fornecido pela Meta.
- `WHATSAPP_GRAPH_API_VERSION`: versão Graph API atualmente indicada no painel/documentação Meta.
- `WHATSAPP_ALLOWED_NUMBER`: número do usuário autorizado, somente dígitos, com código do país e DDD (ex.: 55DDXXXXXXXXX). Não inclua +, espaços ou traços.

Mantenha também as variáveis existentes de Redis e sincronização. O webhook coloca os lançamentos reconhecidos na mesma fila usada por `GET /api/pending`.

## Configuração de teste na Meta

1. Crie um aplicativo no Meta for Developers e adicione o produto WhatsApp.
2. Use o número de teste disponibilizado no painel WhatsApp > API Setup.
3. Adicione e confirme seu próprio celular como destinatário de teste.
4. Configure o webhook com a URL acima e o mesmo `WHATSAPP_VERIFY_TOKEN`.
5. Assine o campo `messages` do objeto WhatsApp Business Account.
6. Copie App Secret, Access Token, Phone Number ID e versão Graph API para as variáveis de ambiente da Vercel.
7. Envie uma mensagem de teste do seu WhatsApp para o número de teste da Meta.

O número de teste serve para desenvolvimento e validação. Não é um número permanente para atendimento de clientes. A publicação em produção e qualquer migração de número ficam fora desta etapa e exigem aprovação explícita.

## Comandos reconhecidos

- `Gastei 35 reais no almoço`
- `Recebi 2500 de salário`
- `Investi 100 reais em renda fixa`

O bot responde com confirmação e a movimentação fica pendente para sincronização no app Android. O acesso é restrito a um único número autorizado; não é uma arquitetura multiusuário.
