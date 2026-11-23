# Spotter Virtual

**Acompanhamento e personalização de treinos de musculação com inteligência artificial.**

O Spotter Virtual funciona como um spotter no bolso. A câmera do celular acompanha a execução, o app corrige a postura por voz durante a série e a carga do próximo treino é ajustada pelo desempenho, sem o usuário digitar nada no meio do treino.

**[Experimente o aplicativo](https://bruno0305.github.io/spotter-virtual/)**

## O problema

Quem treina sozinho não tem ninguém para validar a execução dos movimentos, e um erro de postura repetido aumenta o risco de lesão. Além disso, digitar cargas no celular durante o treino quebra o ritmo e o foco.

## Como o produto resolve

| Pilar | O que o app faz |
| --- | --- |
| **Visão computacional** | Estima a posição de ombros, cotovelos, punhos, quadril, joelhos e tornozelos pela câmera e mede os ângulos de cada repetição. |
| **Spotter por áudio** | Conta as repetições em voz alta e avisa na hora quando detecta amplitude parcial, postura fora do padrão ou descida rápida. |
| **Gestão automática** | Registra séries, repetições e qualidade da execução, controla o descanso e sugere a carga da próxima série e do próximo treino. |

## Funcionalidades do MVP

**Exercícios monitorados:** os três de maior complexidade e risco.

| Exercício | Correções por voz |
| --- | --- |
| Agachamento livre | amplitude parcial, tronco inclinado demais, descida rápida |
| Supino | amplitude parcial, punho desalinhado com o cotovelo, descida rápida |
| Levantamento terra | extensão incompleta do quadril, quadril subindo antes do peito |

**Treino completo:**

- Várias séries com descanso cronometrado, contagem regressiva por voz e início automático da série seguinte.
- Placar sobre o vídeo com repetições, série atual e carga, e a articulação analisada destacada com o ângulo.
- Indicadores ao vivo: ângulo, qualidade (porcentagem de repetições sem correção), correções por tipo e tempo médio de descida.
- Resumo do treino com a qualidade de cada série.

**Progressão automática de carga** (regra de dupla progressão, ilustrativa):

- Entre séries: se a série ficou abaixo de 75% da meta, a carga da próxima cai 10%.
- Entre treinos: todas as séries completas com qualidade de 85% ou mais fazem a carga subir (2,5 kg no agachamento e no terra, 2 kg no supino). Meta batida com muitas correções mantém a carga.
- Ao escolher o exercício, o campo de carga já vem preenchido com a sugestão do último treino.

**Evolução:** gráfico de carga por treino colorido pela qualidade, próxima carga sugerida, indicadores, histórico completo e exportação em CSV. O botão *Carregar exemplo de evolução* gera três semanas de treinos fictícios para a apresentação.

## Como testar

### Demonstração sem câmera

1. Escolha um exercício. Para uma apresentação rápida, use **4 repetições** e **2 séries**.
2. No cenário **Com correções do Spotter**, clique em **Rodar demonstração**. Na primeira série, a 1ª repetição é parcial e a 2ª tem erro de postura, e o app avisa por voz. Na segunda série, a execução já sai corrigida.
3. Troque para **Execução perfeita** e rode de novo: ao final, o Spotter sugere aumentar a carga, e o campo de carga já vem atualizado.
4. Na seção **Evolução**, veja o gráfico e o histórico.

Na demonstração, o descanso é encurtado para 6 segundos.

### Câmera ao vivo

1. Abra pelo link acima (HTTPS) e clique em **Ativar câmera**.
2. Permita o acesso e aguarde o modelo carregar (precisa de internet).
3. Apoie o celular de lado, a uns 2 a 3 metros, com o corpo inteiro no quadro, e faça o teste sem carga.

Para rodar localmente: `python3 -m http.server 8000` (ou `py -m http.server 8000` no Windows) na pasta do projeto e acesse `http://localhost:8000`. A câmera não funciona abrindo o arquivo direto (`file://`); a demonstração funciona.

## Privacidade

O vídeo é analisado no próprio navegador e não é gravado nem enviado a nenhum servidor. O histórico fica salvo só no navegador usado.

## Estrutura do projeto

```
index.html              página e interface
manifest.webmanifest    instalação na tela inicial do celular
assets/icon.svg         ícone
css/styles.css          estilos (tema escuro, responsivo)
js/exercises.js         exercícios: limites de ângulo e regras de postura
js/geometry.js          ângulos, inclinações e escolha do lado mais visível
js/tracker.js           máquina de estados da repetição e correções
js/progression.js       regras de progressão de carga
js/storage.js           histórico (localStorage), dados de exemplo e CSV
js/audio.js             voz (Web Speech) e sinais sonoros (Web Audio)
js/simulator.js         poses simuladas para a demonstração
js/renderer.js          desenho do esqueleto e do ângulo
js/camera.js            câmera e MediaPipe Pose Landmarker
js/charts.js            gráfico de evolução em SVG
js/app.js               fluxo do treino e interface
```

Sem etapa de build: é só HTML, CSS e JavaScript, publicado direto pelo GitHub Pages.

## Tecnologias

- **HTML, CSS e JavaScript** puros.
- **MediaPipe Pose Landmarker** para estimar as articulações no próprio aparelho.
- **Web Speech API** para as correções por voz e **Web Audio** para os sinais sonoros.
- **GitHub Pages** para hospedagem.

## Escopo e próximos passos

Os limites de ângulo e as regras de correção são experimentais e ainda precisam de validação biomecânica. As sugestões de carga não substituem a orientação de um profissional de educação física.

Próximos passos previstos: validar os limites com profissionais, ampliar a lista de exercícios, sincronizar o histórico na nuvem e publicar como app nativo.

## Equipe

- Bruno Vinicius Lira de Almeida
- Paulo César Santos de Vasconcelos
- Carlos Wagner Farias da Fonseca
