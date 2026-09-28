import { useEffect, useRef } from 'react';
import type { VibesProInputProps } from '../types';
import scrollImage from '../assets/scroll.png';
import { useLanguage } from '../../../contexts/LanguageContext';

export default function VibesProInput({ value = '', onChange, onSend, placeholder }: VibesProInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { t } = useLanguage();
  const placeholderText = placeholder ?? t('vibespro.chat.placeholder');

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [value]);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, width: '100%', minWidth: 0 }}>
      <div style={{ position: 'relative', flex: '1 1 auto', minWidth: 0, maxWidth: '100%', width: '100%' }}>
        <img src={scrollImage} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholderText}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            border: 'none',
            background: 'transparent',
            resize: 'none',
            outline: 'none',
            boxSizing: 'border-box',
            padding: '20px 22px 24px',
            fontFamily: 'Georgia, serif',
            color: '#4b2e1c',
            lineHeight: 1.45,
            overflow: 'hidden',
            maxWidth: '100%',
          }}
        />
      </div>
      <button type="button" onClick={onSend} style={{ flexShrink: 0, padding: '10px 14px', borderRadius: 999, border: '1px solid #d4af37', background: '#f3d07b', color: '#111827', fontWeight: 700, whiteSpace: 'nowrap' }}>{t('vibespro.chat.send')}</button>
    </div>
  );
}
