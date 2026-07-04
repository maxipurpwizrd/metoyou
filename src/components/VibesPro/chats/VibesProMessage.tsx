import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { VibesProMessageProps } from '../types';
import scrollImage from '../assets/scroll.png';

const MAX_WIDTH = '75vw';

export default function VibesProMessage({ message, isOwn }: VibesProMessageProps) {
  const [height, setHeight] = useState(0);
  const measureRef = useRef<HTMLDivElement | null>(null);

  const text = message?.text ?? '';

  useMemo(() => {
    if (!measureRef.current) return;
    const nextHeight = measureRef.current.scrollHeight;
    setHeight(nextHeight);
  }, [text]);

  return (
    <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      <div style={{ position: 'relative', minWidth: 'fit-content', maxWidth: MAX_WIDTH }}>
        <div ref={measureRef} style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', maxWidth: MAX_WIDTH, minWidth: 'fit-content', padding: '22px 24px 28px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'Georgia, serif', color: '#4b2e1c', lineHeight: 1.45 }}>
          {text}
        </div>

        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          style={{ position: 'relative', width: 'auto', minWidth: 140 }}
        >
          <img src={scrollImage} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.2 }}
            style={{ position: 'absolute', inset: 0, padding: '22px 24px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#4b2e1c', fontFamily: 'Georgia, serif', lineHeight: 1.45, maxWidth: MAX_WIDTH }}
          >
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</div>
            {message?.createdAt ? <div style={{ fontSize: 12, opacity: 0.7 }}>{message.createdAt}</div> : null}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
