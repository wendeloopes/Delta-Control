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


## Pareamento seguro de dispositivos (Fase D)

O endpoint `POST /api/pair` autoriza um dispositivo usando um código administrativo de uso único. O token de 256 bits permanece no SecureStore do aparelho; somente o SHA-256 é salvo no conjunto `delta:authorized_devices` do Upstash Redis.

### Configuração de Preview

1. No projeto Vercel, configure `DELTA_PAIRING_CODE` como variável **Sensitive/Secret** no ambiente Preview. Use um valor aleatório de 64 caracteres hexadecimais (32 bytes). Não use o token do webhook, não coloque o valor no código e não o envie em logs.
2. Confirme que `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` estão configurados no mesmo ambiente Preview.
3. No ambiente em que o app Expo for compilado, configure `EXPO_PUBLIC_DELTA_API_URL` com a URL base do deployment Preview do backend (por exemplo, a URL `*.vercel.app`, sem `/api` no final).
4. Recompile o app para que a variável pública de URL seja incorporada ao bundle.
5. No app, abra **Perfil → Sincronização segura**, cole o código administrativo e toque em **Parear dispositivo**.

### Regras do código

- O código deve ter 64 caracteres hexadecimais e é enviado apenas durante o pareamento.
- O backend consome o código atomicamente no Redis e grava apenas seu hash como marcador; o código não pode ser reutilizado.
- Para autorizar outro aparelho, gere um código novo, substitua `DELTA_PAIRING_CODE` no Vercel Preview e aguarde o novo deployment antes de parear.
- Não configure o segredo em `EXPO_PUBLIC_*`, não o inclua em arquivos versionados e não o reutilize como segredo do webhook.
- O endpoint falha fechado se o segredo ou o Redis não estiverem configurados.
- O PR continua isolado; este trabalho não habilita produção nem altera `main`.

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
