'use client';

import { Draggable } from '@hello-pangea/dnd';
import { useRouter } from 'next/navigation';
import { LEAD_SOURCES, LEAD_SCORES } from '@/lib/utils/constants';

function getDaysInStage(stageChangedAt) {
  if (!stageChangedAt) return 0;
  const changed = new Date(stageChangedAt);
  const now = new Date();
  return Math.floor((now - changed) / (1000 * 60 * 60 * 24));
}

const PipelineCard = ({ lead, index }) => {
  const router = useRouter();

  const sourceConfig = LEAD_SOURCES.find((s) => s.value === lead.source);
  const scoreConfig = LEAD_SCORES.find((s) => s.value === lead.score);
  const days = getDaysInStage(lead.pipelineStageChangedAt);

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="card p-3 mb-2 border-0 shadow-sm cursor-pointer"
          style={{
            background: snapshot.isDragging
              ? 'var(--bs-gray-700)'
              : 'var(--bs-gray-800)',
            ...provided.draggableProps.style,
          }}
          onClick={() => router.push(`/leads/${lead.id}`)}
        >
          <h6 className="fw-semibold text-white mb-1 text-sm">
            {lead.fullName}
          </h6>

          {lead.companyName && (
            <p className="text-secondary-light text-xs mb-2">
              {lead.companyName}
            </p>
          )}

          <div className="d-flex flex-wrap gap-1 mb-2">
            {sourceConfig && (
              <span
                className="badge text-xs fw-medium"
                style={{
                  background: 'rgba(13,202,240,0.15)',
                  color: '#0dcaf0',
                }}
              >
                {sourceConfig.label}
              </span>
            )}

            {scoreConfig && (
              <span
                className="badge text-xs fw-medium"
                style={{
                  background: `${scoreConfig.color}22`,
                  color: scoreConfig.color,
                }}
              >
                {scoreConfig.label}
              </span>
            )}
          </div>

          <div className="d-flex align-items-center justify-content-between">
            <span className="text-secondary-light text-xs">
              {days === 0 ? 'Today' : `${days}d in stage`}
            </span>
            {lead.assignedName && (
              <span className="text-secondary-light text-xs">
                {lead.assignedName.split(' ')[0]}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default PipelineCard;
