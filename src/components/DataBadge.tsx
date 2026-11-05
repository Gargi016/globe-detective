export type DataKind = 'verified' | 'computed' | 'estimate' | 'dataset' | 'descriptive';

const COPY: Record<DataKind, { label: string; title: string }> = {
  verified: {
    label: 'Verified',
    title: 'Checked against the cited sources.',
  },
  computed: {
    label: 'Computed',
    title: 'Calculated from the map geometry on this page. Approximate; not an official figure.',
  },
  estimate: {
    label: 'Estimate',
    title: 'An inference or best guess, not a confirmed fact.',
  },
  dataset: {
    label: 'CShapes',
    title: 'Taken directly from the CShapes 2.0 dataset, including its coding conventions and labels.',
  },
  descriptive: {
    label: 'Our label',
    title: 'This project’s own wording for a situation that had no official state name.',
  },
};

export interface DataBadgeProps {
  kind: DataKind;
}

/** Marks where a piece of information comes from, and how far to trust it. */
export default function DataBadge({ kind }: DataBadgeProps) {
  const { label, title } = COPY[kind];
  return (
    <span className={`badge badge--${kind}`} title={title}>
      {label}
    </span>
  );
}
