# Spotter Virtual

O Spotter Virtual é um protótipo acadêmico de acompanhamento de treinos de musculação. Ele usa a câmera para estimar a posição das articulações, contar repetições e avisar por voz quando detecta um movimento mais curto que o limite definido para o exercício.

**[Experimente o aplicativo](https://bruno0305.github.io/spotter-virtual/)**

## Exercícios disponíveis

- Agachamento livre
- Supino
- Levantamento terra

## Como testar

### Demonstração sem câmera

1. Escolha um exercício e defina a meta de repetições.
2. Clique em **Rodar demonstração**.
3. Deixe **Simular uma repetição parcial** marcada para ver o alerta. Essa tentativa fica fora da contagem.

Para testar a lógica de progressão, informe **20 kg** como carga de exemplo e compare duas séries que atingem a meta. Com um alerta, o resumo mostra **20 kg**. Sem alertas, mostra **20,5 kg** como exemplo de progressão.

### Câmera ao vivo

1. Abra o aplicativo pelo link acima e clique em **Ativar câmera**.
2. Permita o acesso à câmera e aguarde o carregamento do modelo.
3. Siga a instrução de enquadramento exibida para o exercício e faça o teste sem carga.

O modo ao vivo precisa de internet para carregar o modelo. O vídeo é analisado no próprio navegador e não é gravado nem enviado a um servidor. O histórico das séries fica salvo no navegador usado no teste.

## Tecnologias

- **HTML, CSS e JavaScript** para a interface e a lógica do aplicativo.
- **MediaPipe Pose Landmarker** para estimar a posição das articulações.
- **GitHub Pages** para hospedar a demonstração.

## Escopo do protótipo

Os limites de ângulo usados para contar repetições e emitir alertas são experimentais e ainda precisam de validação biomecânica. A progressão de carga é ilustrada apenas na simulação.

## Equipe

- Bruno Vinicius Lira de Almeida
- Paulo César Santos de Vasconcelos
- Carlos Wagner Farias da Fonseca
