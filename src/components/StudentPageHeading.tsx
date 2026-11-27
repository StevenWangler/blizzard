export function StudentPageHeading({ title, description }: { title: string; description: string }) {
  return <header className="student-page-heading"><h2>{title}</h2><p>{description}</p></header>
}
