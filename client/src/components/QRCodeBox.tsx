import QRCode from "react-qr-code";

export default function QRCodeBox({ code }: { code: string }) {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/?code=${code}`
      : code;

  return (
    <QRCode value={url} size={120} />
  );
}