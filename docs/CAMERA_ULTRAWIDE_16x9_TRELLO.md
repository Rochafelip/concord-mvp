# 🎥 Ajustar câmera Ultra Wide para comportamento 16:9

## Descrição
Implementar um Card de configuração da câmera permitindo selecionar entre 16:9 e Ultra Wide. A câmera Ultra Wide deve manter seu campo de visão ampliado, porém seguir o mesmo padrão visual e comportamento da câmera 16:9, garantindo consistência no layout da chamada.

## Requisitos

### Funcionalidades
- Adicionar opção 16:9 (formato padrão)
- Adicionar opção Ultra Wide (campo de visão ampliado)
- Manter a captura da Ultra Wide com seu campo de visão original
- Exibir a Ultra Wide dentro de um container 16:9
- Utilizar o mesmo comportamento de `object-fit` e posicionamento da câmera 16:9
- Garantir que ambas as câmeras tenham o mesmo tamanho e proporção no grid da chamada
- Evitar distorção, achatamento ou alteração da proporção da imagem
- Validar o comportamento em diferentes tamanhos de tela
- Salvar a preferência/configuração selecionada pelo usuário

### Técnico
- Usar o mesmo componente React para ambos os modos (16:9 e Ultra Wide)
- Implementar lógica única de renderização com `aspect-ratio: 16 / 9`
- Aplicar `object-fit: cover` e `object-position: center` para ambos os modos
- Manter captura nativa Ultra Wide com campo de visão ampliado
- Container visual padronizado em 16:9 para exibição
- Persistir preferência via localStorage
- Toggle para controlar comportamento de exibição Ultra Wide (padrão: 16:9)

### Interface
- Card de configuração com preview ao vivo da câmera
- Preview com badge indicando formato atual (16:9 ou Ultra Wide)
- Radio buttons para seleção entre 16:9 e Ultra Wide
- Switch "Exibição Ultra Wide" para manter comportamento 16:9 (padrão: checked)
- Botão "Salvar configuração"
- Status indicando "● Ativa" quando câmera está ativa
- Design consistente com UI do Concord

## Lógica de Implementação

```
CÂMERA
   │
┌────────┴────────┐
│                 │
16:9            ULTRA WIDE
│                 │
└────────┬────────┘
         ↓
   MESMO COMPONENTE
         ↓
    aspect-ratio
      16 / 9
         ↓
    object-fit
      cover
```

**Princípio chave:** Não transformar a imagem capturada pela Ultra Wide em uma câmera 16:9 de verdade. Manter o campo de visão da Ultra Wide e fazer somente a área de exibição obedecer ao mesmo padrão 16:9.

## Especificação Visual

### Componente CameraCard
```tsx
<div class="camera-card">
  <div class="camera-card-header">
    <div>
      <h3>Configuração da câmera</h3>
      <p>Ajuste o formato e o comportamento da câmera.</p>
    </div>
    <span class="camera-status">● Ativa</span>
  </div>

  <div class="camera-preview">
    <video id="cameraPreview" autoplay playsinline muted></video>
    <span class="preview-badge">16:9</span>
  </div>

  <div class="camera-options">
    <label class="camera-option active">
      <input type="radio" name="cameraMode" value="16:9" checked>
      <div>
        <strong>16:9</strong>
        <small>Formato padrão</small>
      </div>
    </label>

    <label class="camera-option">
      <input type="radio" name="cameraMode" value="ultrawide">
      <div>
        <strong>Ultra Wide</strong>
        <small>Campo de visão ampliado</small>
      </div>
    </label>
  </div>

  <div class="camera-setting">
    <div>
      <strong>Exibição Ultra Wide</strong>
      <small>Manter o mesmo comportamento da câmera 16:9</small>
    </div>

    <label class="switch">
      <input type="checkbox" id="ultrawide16x9" checked>
      <span></span>
    </label>
  </div>

  <button class="camera-button">
    Salvar configuração
  </button>
</div>
```

### Estilos CSS Principais
- Card: 360px width, border-radius 16px, background #fff
- Preview: aspect-ratio 16/9, object-fit: cover para ambos os modos
- Radio buttons: Grid 1fr 1fr, borda highlight quando selecionado
- Switch: Toggle para comportamento de exibição
- Botão: Full width, background #6366f1, hover effects

## Resultado Esperado

A câmera Ultra Wide deve ter o mesmo comportamento visual da câmera 16:9, mantendo o campo de visão ampliado, mas sendo apresentada em uma área padronizada de 16:9, sem distorções e sem quebrar o layout da chamada.

## Benefícios

- **Consistência visual:** Todas as câmeras no grid têm o mesmo tamanho e proporção
- **Campo de visão preservado:** Ultra Wide mantém seu campo de visão ampliado nativo
- **Layout robusto:** Evita problemas de altura/distorção entre diferentes participantes
- **UX simplificada:** Usuário seleciona formato, comportamento visual é consistente
- **Performance:** Sem processamento adicional de imagem, apenas CSS puro

## Critérios de Aceite

- [ ] Card de configuração implementado com preview ao vivo
- [ ] Seleção entre 16:9 e Ultra Wide funcional
- [ ] Câmera Ultra Wide mantém campo de visão ampliado na captura
- [ ] Exibição padronizada em 16:9 para ambos os modos no grid
- [ ] Switch de comportamento 16:9 funcional (padrão: checked)
- [ ] Preferência salva via localStorage
- [ ] Nenhuma distorção ou achatamento visual perceptível
- [ ] Layout consistente em diferentes tamanhos de tela
- [ ] Design consistente com UI do Concord
