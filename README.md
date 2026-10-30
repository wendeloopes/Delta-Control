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
