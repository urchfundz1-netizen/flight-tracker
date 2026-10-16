import { emergencyNotice, splitEmphasis } from "@/lib/format";

/**
 * The emergency-landing passenger letter. Shared by the boarding-pass ticket
 * and the live Planefinder view, which pass in their own class names so each
 * keeps its skin. Emphasised spans come from `**bold**` markers, emitted as
 * <strong> rather than raw HTML.
 */
export default function EmergencyNotice({
  flight,
  titleClassName,
  bodyClassName,
  paraClassName,
  signatureClassName,
}) {
  const notice = emergencyNotice(flight);

  return (
    <>
      <p className={titleClassName}>{notice.heading}</p>
      <div className={bodyClassName}>
        {notice.paragraphs.map((paragraph, index) => (
          <p key={index} className={paraClassName}>
            {splitEmphasis(paragraph).map((segment, segmentIndex) =>
              segment.bold ? (
                <strong key={segmentIndex}>{segment.text}</strong>
              ) : (
                <span key={segmentIndex}>{segment.text}</span>
              ),
            )}
          </p>
        ))}
        <p className={signatureClassName}>
          <strong>{notice.signature}</strong>
        </p>
      </div>
    </>
  );
}
