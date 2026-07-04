import type { VibesProFalconSendProps } from '../types';
import falconAsset from '../assets/falcon.json';

export default function VibesProFalconSend({ onSend, disabled = false }: VibesProFalconSendProps) {
  return (
    <button type="button" onClick={onSend} disabled={disabled} style={{ padding: '10px 14px', borderRadius: 999, border: '1px solid #d4af37', background: '#f3d07b', color: '#111827', fontWeight: 700 }}>
      <span aria-hidden="true">🦅</span> Send
    </button>
  );
}
