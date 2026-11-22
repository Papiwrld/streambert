/**
 * Right-hand credits column on detail pages ("Starring", "Director"/"Creators").
 * Plain text only; the full list stays in the Cast modal.
 */
export default function DetailAside({ type, cast, crew, createdBy, onShowCast }) {
  const starring = (cast || []).slice(0, 4).map((c) => c.name);
  const people =
    type === "tv"
      ? (createdBy || []).map((c) => c.name)
      : (crew || []).filter((c) => c.job === "Director").map((c) => c.name);
  const uniquePeople = [...new Set(people)].slice(0, 3);
  const label = type === "tv" ? "Creators" : "Director";

  if (starring.length === 0 && uniquePeople.length === 0) return null;

  return (
    <aside className="detail-aside">
      {starring.length > 0 && (
        <p>
          <span className="detail-aside__label">Starring</span>{" "}
          {starring.join(", ")}
          {cast.length > starring.length && onShowCast && (
            <>
              {", "}
              <button className="detail-aside__more" onClick={onShowCast}>
                more
              </button>
            </>
          )}
        </p>
      )}
      {uniquePeople.length > 0 && (
        <p>
          <span className="detail-aside__label">
            {uniquePeople.length === 1 && type === "tv" ? "Creator" : label}
          </span>{" "}
          {uniquePeople.join(", ")}
        </p>
      )}
    </aside>
  );
}
