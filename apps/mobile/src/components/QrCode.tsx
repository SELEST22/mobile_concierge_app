import React from 'react';
import QRCodeSvg from 'react-native-qrcode-svg';
import { palette } from '../theme';

/** Renders a QR code in the Selest brand colours. */
export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  return (
    <QRCodeSvg
      value={value}
      size={size}
      backgroundColor="#FFFFFF"
      color={palette.deepSpaceBlue}
    />
  );
}
