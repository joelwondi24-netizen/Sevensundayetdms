import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface RealQrCodeProps {
  value: string;
  size?: number;
  className?: string;
  label?: string;
}

export const RealQrCode: React.FC<RealQrCodeProps> = ({
  value,
  size = 88,
  className = '',
  label,
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    const payload = (value || 'SEVEN-SUNDAY-EMS').trim();
    QRCode.toDataURL(payload, {
      width: Math.max(96, size * 2),
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#18243A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`border border-slate-300 bg-white flex items-center justify-center text-[10px] font-mono text-[#172033] ${className}`}
      >
        QR
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <img
        src={dataUrl}
        alt={label || `QR Code: ${value}`}
        style={{ width: size, height: size }}
        className="bg-white border border-slate-200 rounded p-0.5 object-contain shrink-0"
      />
      {label && (
        <span className="text-[10px] font-mono font-semibold text-[#172033] dark:text-slate-300 text-center leading-tight">
          {label}
        </span>
      )}
    </div>
  );
};
