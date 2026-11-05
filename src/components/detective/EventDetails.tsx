import SourceLinks from '../history/SourceLinks';
import { describeRanges } from '../../detective/dateRange';
import { CATEGORY_LABEL } from '../../detective/types';
import type { HistoricalEvent } from '../../detective/types';

/** What happened, when a globe that is up to date would show it, and where that comes from. */
export default function EventDetails({ event }: { event: HistoricalEvent }) {
  return (
    <div className="evd">
      <p className="evd__desc">{event.description}</p>
      <dl className="evd__facts">
        <div>
          <dt>Category</dt>
          <dd>{CATEGORY_LABEL[event.category]}</dd>
        </div>
        <div>
          <dt>A globe that is up to date shows this</dt>
          <dd>{describeRanges(event.valid, 'earlier times')}</dd>
        </div>
        <div>
          <dt>Date evidence</dt>
          <dd>
            <span className={`qual qual--${event.quality}`}>
              {event.quality === 'documented' ? 'Documented date' : 'Approximate or gradual date'}
            </span>
            {event.precision !== 'day' && <span className="qual qual--precision"> known to the {event.precision}</span>}
          </dd>
        </div>
      </dl>
      {event.openStartNote && <p className="evd__note">{event.openStartNote}</p>}
      {event.notes && <p className="evd__note">{event.notes}</p>}
      <SourceLinks sources={event.sources} />
    </div>
  );
}
