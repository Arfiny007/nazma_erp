interface CompanyFooterProps {
  message: string;
}

export function CompanyFooter({ message }: CompanyFooterProps) {
  return (
    <footer className="document-avoid-break mt-auto pt-2">
      <hr className="doc-hr mb-2" />
      <p className="text-center text-[10pt] font-semibold italic doc-blue">{message}</p>
    </footer>
  );
}
