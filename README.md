# Bora dançar — credenciais para o aulão

## Publicar no GitHub Pages

O projeto já inclui `.github/workflows/pages.yml` e `.nojekyll`. Envie o conteúdo desta pasta para um repositório GitHub, use a branch `main` ou `master` e, em **Settings → Pages**, selecione **GitHub Actions**. A cada push, o workflow publica a pasta `public/` automaticamente.

O GitHub Pages hospeda somente os arquivos estáticos. Por isso, a página e a prévia da credencial funcionam nele, mas os cadastros feitos nesse modo ficam marcados como demonstração no navegador e não são enviados ao Google Planilhas. Para salvar dados reais, mantenha o `server.js` em um serviço Node/servidor e configure `GOOGLE_SCRIPT_URL`, `GOOGLE_SCRIPT_SECRET` e `PUBLIC_ORIGIN`; nunca envie `.env` ou `data/` ao GitHub.

Para uma publicação Pages no endereço raiz `usuario.github.io`, os caminhos atuais funcionam diretamente. Em um endereço de projeto `usuario.github.io/nome-do-repositorio`, use a configuração de Pages com o artefato na raiz do domínio ou ajuste os links absolutos antes de publicar.

Projeto para abrir no VS Code, feito com **HTML, CSS e JavaScript**, com um servidor **Node.js sem dependências externas**. A integração com Google Planilhas e Drive usa um pequeno Google Apps Script.

## Abrir e executar

1. Abra `aulao-fitdance.code-workspace` no VS Code.
2. Tenha Node.js 22.13 ou mais recente instalado.
3. No terminal integrado, execute:

```sh
node --env-file-if-exists=.env server.js
```

4. Abra **http://127.0.0.1:3000**. Também é possível apertar **F5** no VS Code ou usar `npm run dev` para reiniciar o servidor automaticamente quando editar arquivos.

Não é necessário executar `npm install`. Use o servidor Node, porque o formulário depende da API; abrir o HTML diretamente ou usar apenas Live Server não executa essa API.

## O que está pronto

O site tem três páginas: **`/`** com as informações do aulão, **`/cadastro.html`** com o formulário e a prévia, e **`/credencial.html`** com a credencial gerada e o download. O formulário abre a página final somente depois da confirmação do salvamento.

A página final usa uma cópia temporária da credencial na sessão da mesma aba. Atualizar essa página preserva a imagem e não envia outro cadastro. Para guardar ou compartilhar a credencial, use o download em PNG; o endereço da página, sozinho, não dá acesso à credencial em outro dispositivo. Se a página for aberta sem uma credencial nessa sessão, ela oferece o acesso ao formulário.

- Página responsiva com informações do evento e botão para criar credencial.
- Nome e sobrenome, idade, WhatsApp com DDD e vínculo com a academia.
- Quatro categorias: convidado não aluno, convidado de outra unidade sem Black, aluno da unidade e aluno Black. O vínculo é informado pelo participante.
- Pergunta sobre interesse em conhecer a academia; para convidados interessados, registra a solicitação do passe de um dia.
- Foto da galeria, captura com câmera ou seis personagens. A foto é recortada no centro, reduzida para 600 × 600 e convertida em JPEG, sem conservar os metadados do arquivo original.
- Contribuição opcional com comes e bebes; o detalhe é obrigatório se a resposta for “sim”.
- Credencial com degradê sorteado, foto/personagem, primeiro nome grande, nome completo, categoria, evento e código EAN-13 com número aleatório e dígito verificador.
- Download da credencial em PNG, proteção contra duplo envio e confirmação somente depois de salvar.
- Código do Google Apps Script para criar a planilha, salvar todas as respostas e guardar fotos em uma pasta privada no Drive.

O código de barras identifica o cadastro. O projeto não está integrado às catracas, ao cadastro de alunos ou à emissão oficial de passes da Smart Fit. A recepção confere nome e número de série na planilha e valida a entrada. O interesse no passe fica como **“aguarda unidade”**.

## Personalizar o evento

Edite `event.config.json` e reinicie o servidor:

| Campo | O que preencher |
| --- | --- |
| `title` | Nome do aulão |
| `instructorName` | Nome da aniversariante/professora |
| `date` | Data real em `AAAA-MM-DD` |
| `time` | Horário, por exemplo `10h às 11h30` |
| `unit`, `city`, `address` | Unidade e endereço confirmados |
| `minimumAge` | Idade mínima, em anos completos |
| `whatToBring` | Orientações para participantes |
| `entryNote` | Instruções confirmadas de entrada |
| `dayPassNote` | Condições confirmadas do passe de um dia |
| `privacyContact` | Contato da organização para correção/exclusão de dados |

O evento está configurado para **17 de setembro de 2026, às 18h30**, na Smart Fit Castelo: **Avenida Francisco José de Camargo Andrade, 262 · Jardim Chapadão · Campinas, SP · 13070-055**. A página inicial mostra uma contagem regressiva que muda de dias para horas, minutos e segundos conforme o horário se aproxima, além de um mapa e um link de rota. O endereço foi conferido na página oficial da unidade; confirme a reserva e a disponibilidade do espaço com a academia antes de divulgar.

A regra inicial é **17 anos ou mais**, interpretação literal de “maiores de 16 anos”. Se pessoas de 16 anos completos puderem entrar, altere `minimumAge` para `16` e a propriedade `MINIMUM_AGE` do Apps Script para o mesmo valor. Essa regra vem do pedido e deve ser alinhada com a organização/unidade.

## Conectar ao seu Google Planilhas

O projeto contém a integração. Nesta instalação, a conexão com a conta Google já foi configurada e validada. Para configurar outra instalação, siga os passos abaixo; o pacote ZIP não inclui o `.env` com as credenciais nem os cadastros locais. Não envie sua senha Google nem o segredo do script no chat.

### 1. Criar o script e a planilha

1. Entre em [Google Apps Script]() na conta que será dona dos cadastros e escolha **Novo projeto**.
2. Copie o conteúdo completo de `google-apps-script/Code.gs` para o arquivo `Código.gs`/`Code.gs` do editor. Salve.
3. Se quiser usar uma planilha existente: em **Configurações do projeto → Propriedades do script**, adicione `SPREADSHEET_ID` com o trecho entre `/d/` e `/edit` no link da planilha. A conta que executará o script precisa ter acesso de edição. Se não preencher, a função de configuração cria uma planilha nova.
4. Selecione a função **setup** no topo do editor e clique em **Executar**. Autorize o acesso à sua planilha e ao Drive. O script cria uma aba **Convidados** e uma pasta de fotos. O registro de execução mostra os links.
5. Em **Configurações do projeto → Propriedades do script**, localize `SHARED_SECRET`. Ele foi gerado pela função `setup` e será usado somente no servidor.

O manifesto `google-apps-script/appsscript.json` também está incluído. Se quiser utilizá-lo, habilite **Mostrar o arquivo de manifesto appsscript.json no editor**, nas configurações, e substitua seu conteúdo pelo arquivo incluído.

### 2. Implantar o aplicativo da Web

1. Clique em **Implantar → Nova implantação**.
2. Selecione **Aplicativo da Web**.
3. Em **Executar como**, selecione **Eu** (a conta que autorizou o script).
4. Em **Quem pode acessar**, selecione **Qualquer pessoa**. Embora o endpoint seja acessível, o script recusa envios sem a assinatura secreta do servidor e nunca lista os convidados.
5. Implante e copie a URL terminada em **`/exec`**. A URL `/dev` não serve para esta configuração.

Contas corporativas podem impedir esse tipo de implantação. Nesse caso, é necessário que o administrador permita essa opção ou que seja usada uma conta autorizada a disponibilizá-la.

### 3. Conectar o servidor

Na pasta do projeto, copie `.env.example` para `.env` e preencha:

```dotenv
STORAGE_MODE=google
HOST=127.0.0.1
PORT=3000
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/SEU_ID_DE_IMPLANTACAO/exec
GOOGLE_SCRIPT_SECRET=COLE_AQUI_O_VALOR_DE_SHARED_SECRET
PUBLIC_ORIGIN=
TRUSTED_PROXY_IPS=
```

Reinicie o servidor. O aviso de demonstração desaparece. Faça um cadastro de teste, confira a nova linha na aba **Convidados** e, se enviou foto, confira o link na coluna **Foto no Drive**. Exclua o cadastro e a foto de teste depois dessa verificação.

**No modo Google, falhas de salvamento impedem a emissão da credencial.** O servidor não passa silenciosamente para armazenamento local. Repetir o mesmo envio recupera a credencial existente, sem acrescentar outra linha. Se você alterar o formulário depois de um envio confirmado cuja resposta se perdeu, pode receber uma mensagem de conflito; procure a organização para corrigir o registro.

Depois de editar o Apps Script, use **Implantar → Gerenciar implantações → Editar → Nova versão → Implantar** para atualizar o código servido pelo `/exec`. Executar `setup()` novamente preserva os IDs e o segredo já criados.

### Se os cadastros não aparecerem

Depois de criar ou alterar o `.env`, pare o servidor com `Ctrl+C` e execute novamente `node --env-file-if-exists=.env server.js`. Recarregue a página. O servidor lê a configuração ao iniciar; uma instância antiga pode continuar salvando localmente mesmo com `STORAGE_MODE=google` no arquivo. O terminal deve mostrar **Google Planilhas: integração ativada**.

Se o relógio do computador diferir do relógio do Google, o cliente ajusta o horário da assinatura usando a resposta HTTPS do Google e repete o envio uma vez. Esse ajuste vale apenas para a integração; não altera o relógio do sistema nem enfraquece a validação do Apps Script.

### O que fica salvo

A planilha tem 29 colunas: data do cadastro, ID do envio, série, nome completo, primeiro nome, idade, WhatsApp, vínculo, categoria, interesse, solicitação e situação do passe, contribuição e item, personagem/foto, link e ID da foto, cores, consentimento e versão, informações do evento, ID da credencial e controles de reenvio. As duas últimas colunas são auxiliares e ficam ocultas.

Fotos enviadas ficam no **Google Drive**, com link na linha correspondente. Um personagem padrão é salvo pelo seu identificador; a credencial usa o emoji desse personagem. Não são criados links públicos de fotos. Mantenha a planilha e a pasta restritas às pessoas que organizam o evento.

## Modo de demonstração

Sem `.env`, ou com `STORAGE_MODE=local`, cada cadastro é salvo em `data/` no computador que executa o servidor. A página informa esse modo, e a credencial traz **DEMONSTRAÇÃO · SEM VALIDADE PARA ENTRADA**. Os dados ficam após reiniciar o servidor, mas não são enviados ao Google.

A pasta `data/` e o arquivo `.env` estão no `.gitignore` e não são servidos pela API. Os registros locais são somente para testes; não existe migração automática deles para o Google. Para apagar uma demonstração, remova o JSON correspondente de `data/` com o servidor parado.

## Disponibilizar aos convidados

O endereço `127.0.0.1` funciona apenas no computador onde o projeto está rodando. Para convidados acessarem pelo próprio celular, hospede o servidor Node em um serviço com HTTPS, configure as variáveis de ambiente e ajuste `PUBLIC_ORIGIN` para a URL final (sem barra no final). Use o modo `google`.

- O servidor usa `PORT` e `HOST`; algumas hospedagens exigem `HOST=0.0.0.0`.
- A câmera no navegador exige **HTTPS**, exceto em localhost. No celular, o botão pode abrir a captura nativa da câmera.
- Se houver um proxy reverso, defina `TRUSTED_PROXY_IPS` somente com os IPs do proxy confiável que acrescenta ou substitui `X-Forwarded-For`. Não aceite esse cabeçalho de qualquer origem; sem proxy, deixe a variável vazia.
- O limite simples é de 40 tentativas por IP em dez minutos. Ele pode ser ajustado em `server.js` conforme o tamanho do evento e a infraestrutura.
- Defina com a organização por quanto tempo os cadastros serão mantidos e o contato de privacidade antes de divulgar o link. Não há exclusão automática programada.

## Estrutura

```text
public/
  index.html          Informações do aulão
  cadastro.html       Formulário e prévia da credencial
  credencial.html     Credencial gerada e download
  styles.css          Estilo e layout responsivo
  home.js             Informações do evento na página inicial
  app.js              Formulário, fotos, câmera, envio e navegação
  result.js           Exibição e download da credencial
  credential-session.js Cópia temporária da credencial na mesma aba
  credential.js       Desenho em canvas e código de barras EAN-13
  assets/             Imagem ilustrativa gerada para o evento
src/domain.js         Validação e geração da credencial no servidor
server.js             API, arquivos públicos e integração com Google
event.config.json     Dados editáveis do evento
google-apps-script/   Script e manifesto para Planilhas + Drive
test/                 Testes automatizados de validação e API
.env.example          Modelo de configuração privada
```

## Verificação

```sh
node --test
npm run check
```

Os testes verificam a regra de idade, nome e WhatsApp, contribuições, categorias, solicitação do passe, código de barras, salvamento local, reenvio, conflitos e bloqueio de acesso aos arquivos privados. O teste HTTP cria e limpa uma pasta temporária, sem gravar em sua lista de convidados. O Apps Script também tem testes com serviços Google simulados: assinaturas, bloqueios, colisões, escape de fórmulas e recuperação de fotos após falha. Simulações não substituem o teste na sua conta Google.

A integração foi preparada a partir da documentação oficial: [aplicativos da Web](https://developers.google.com/apps-script/guides/web), [Content Service](https://developers.google.com/apps-script/guides/content), [assinaturas HMAC](https://developers.google.com/apps-script/reference/utilities/utilities) e [bloqueio de gravações concorrentes](https://developers.google.com/apps-script/reference/lock/lock-service). A conexão real precisa ser validada após a autorização na sua conta Google.

Imagem do topo: ilustração fotográfica gerada por IA, com pessoas fictícias. Não representa a professora nem uma aula real da unidade.
