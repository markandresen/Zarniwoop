<script lang="ts">
  import { untitledIcons, type UntitledIconName } from './registry'

  type Props = {
    name: UntitledIconName
    size?: number | string
    strokeWidth?: number | string
    class?: string
  }

  let {
    name,
    size = 18,
    strokeWidth = 2,
    class: className = ''
  }: Props = $props()

  const paths = $derived(untitledIcons[name])
</script>

<svg
  class={className}
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#each paths as d}
    <path {d} />
  {/each}
</svg>
