<script lang="ts">
  /** Lightweight CSS status orb — brand-tinted, pulses while busy/listening. */
  type OrbState = 'idle' | 'listening' | 'busy'
  type OrbVisual = 'zarniwoop' | 'work'

  type Props = {
    orbState?: OrbState
    size?: 'icon' | 'sm' | 'md' | 'lg'
    visual?: OrbVisual
  }

  let { orbState = 'idle', size = 'md', visual = 'zarniwoop' }: Props = $props()

  const SIZE_PX = { icon: 28, sm: 64, md: 176, lg: 248 } as const
  const side = $derived(SIZE_PX[size])
</script>

<span
  class="orb {visual} {orbState}"
  style="width: {side}px; height: {side}px"
  role="img"
  aria-label="Zarniwoop status: {orbState}"
></span>

<style>
  .orb {
    display: inline-block;
    flex-shrink: 0;
    border-radius: 50%;
    background: radial-gradient(
      circle at 35% 30%,
      color-mix(in srgb, var(--zw-brand) 35%, white) 0%,
      var(--zw-brand) 45%,
      var(--zw-brand-dim) 100%
    );
    box-shadow: 0 0 12px color-mix(in srgb, var(--zw-brand) 45%, transparent);
  }

  .orb.work {
    opacity: 0.9;
  }

  .orb.busy,
  .orb.listening {
    animation: orb-pulse 1.4s ease-in-out infinite;
  }

  @keyframes orb-pulse {
    0%,
    100% {
      transform: scale(1);
      filter: brightness(1);
    }
    50% {
      transform: scale(1.08);
      filter: brightness(1.25);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .orb.busy,
    .orb.listening {
      animation: none;
    }
  }
</style>
