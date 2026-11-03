/** Distinct icon for each supported attachment type using the project's image assets. */
type Props = {
  filename: string
  /** Size applied to the outer wrapper. Defaults to "h-9 w-10" */
  className?: string
}

const FILE_IMAGES: Record<string, string> = {
  pdf:  '/images/pdf-file.png',
  doc:  '/images/doc-file.png',
  docx: '/images/doc-file.png',
  ppt:  '/images/ppt-file.png',
  pptx: '/images/ppt-file.png',
}

export default function FileTypeIcon({ filename, className = 'h-9 w-10' }: Props) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const src = FILE_IMAGES[ext]

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded bg-light-gray/50 ${className}`}
    >
      {src
        ? <img src={src} alt="" className="h-7 w-7 object-contain" />
        : <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-gray"><path d="M4 2h8l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2Z"/><path d="M12 2v4h4"/></svg>
      }
    </span>
  )
}
