'use client';

import { useState, useCallback, useTransition } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { toast } from 'react-toastify';
import PipelineCard from './PipelineCard';
import { updateLeadStage } from '@/lib/actions/leads';
import { PIPELINE_STAGES, LEAD_SOURCES, LEAD_SCORES } from '@/lib/utils/constants';

const PipelineBoard = ({ initialLeads, teamMembers }) => {
  const [columns, setColumns] = useState(() => {
    const cols = {};
    for (const stage of PIPELINE_STAGES) {
      cols[stage.value] = initialLeads[stage.value] || [];
    }
    return cols;
  });

  const [filters, setFilters] = useState({
    source: 'all',
    score: 'all',
    assignedTo: 'all',
  });

  const [, startTransition] = useTransition();

  const handleDragEnd = useCallback(
    (result) => {
      const { destination, source, draggableId } = result;

      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      const sourceCol = source.droppableId;
      const destCol = destination.droppableId;

      // Find the lead being dragged
      const lead = columns[sourceCol].find((l) => l.id === draggableId);
      if (!lead) return;

      // Optimistic update
      setColumns((prev) => {
        const newCols = { ...prev };

        // Remove from source
        const newSource = [...prev[sourceCol]];
        newSource.splice(source.index, 1);
        newCols[sourceCol] = newSource;

        // Add to destination
        const newDest = [...prev[destCol]];
        newDest.splice(destination.index, 0, {
          ...lead,
          pipelineStage: destCol,
          pipelineStageChangedAt: new Date().toISOString(),
        });
        newCols[destCol] = newDest;

        return newCols;
      });

      // Server update
      startTransition(async () => {
        const res = await updateLeadStage(draggableId, destCol);
        if (res?.error) {
          toast.error(res.error);
          // Revert on failure
          setColumns((prev) => {
            const newCols = { ...prev };
            // Remove from dest
            newCols[destCol] = prev[destCol].filter(
              (l) => l.id !== draggableId
            );
            // Add back to source at original position
            const restored = [...prev[sourceCol]];
            restored.splice(source.index, 0, lead);
            newCols[sourceCol] = restored;
            return newCols;
          });
        } else {
          const stageLabel = PIPELINE_STAGES.find(
            (s) => s.value === destCol
          )?.label;
          toast.success(`Moved to ${stageLabel}`);
        }
      });
    },
    [columns]
  );

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Apply filters client-side
  const getFilteredLeads = (stageLeads) => {
    return stageLeads.filter((lead) => {
      if (filters.source !== 'all' && lead.source !== filters.source)
        return false;
      if (filters.score !== 'all' && lead.score !== filters.score) return false;
      if (
        filters.assignedTo !== 'all' &&
        lead.assignedTo !== filters.assignedTo
      )
        return false;
      return true;
    });
  };

  const totalFiltered = PIPELINE_STAGES.reduce(
    (sum, stage) => sum + getFilteredLeads(columns[stage.value]).length,
    0
  );

  return (
    <>
      {/* Filter Bar */}
      <div className="card p-3 mb-4">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <div className="d-flex align-items-center gap-2">
            <label className="text-secondary-light text-sm fw-medium mb-0">
              Source
            </label>
            <select
              className="form-select form-select-sm bg-base"
              style={{ width: '150px' }}
              value={filters.source}
              onChange={(e) => handleFilterChange('source', e.target.value)}
            >
              <option value="all">All Sources</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="d-flex align-items-center gap-2">
            <label className="text-secondary-light text-sm fw-medium mb-0">
              Score
            </label>
            <select
              className="form-select form-select-sm bg-base"
              style={{ width: '130px' }}
              value={filters.score}
              onChange={(e) => handleFilterChange('score', e.target.value)}
            >
              <option value="all">All Scores</option>
              {LEAD_SCORES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="d-flex align-items-center gap-2">
            <label className="text-secondary-light text-sm fw-medium mb-0">
              Assigned
            </label>
            <select
              className="form-select form-select-sm bg-base"
              style={{ width: '160px' }}
              value={filters.assignedTo}
              onChange={(e) => handleFilterChange('assignedTo', e.target.value)}
            >
              <option value="all">Everyone</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </div>

          <span className="text-secondary-light text-sm ms-auto">
            {totalFiltered} lead{totalFiltered !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto scroll-sm pb-3">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div
            className="d-flex gap-3"
            style={{ minWidth: `${PIPELINE_STAGES.length * 240}px` }}
          >
            {PIPELINE_STAGES.map((stage) => {
              const stageLeads = getFilteredLeads(columns[stage.value]);

              return (
                <div
                  key={stage.value}
                  className="flex-shrink-0"
                  style={{ width: '230px' }}
                >
                  {/* Column Header */}
                  <div
                    className="card p-0 mb-2 border-0"
                    style={{ borderTop: `3px solid ${stage.color}` }}
                  >
                    <div className="card-body px-3 py-2 d-flex align-items-center justify-content-between">
                      <h6 className="text-sm fw-semibold mb-0 text-white">
                        {stage.label}
                      </h6>
                      <span
                        className="badge rounded-pill text-xs"
                        style={{
                          background: `${stage.color}33`,
                          color: stage.color,
                        }}
                      >
                        {stageLeads.length}
                      </span>
                    </div>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={stage.value}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="rounded-3 p-2"
                        style={{
                          minHeight: '120px',
                          background: snapshot.isDraggingOver
                            ? 'rgba(3,52,87,0.4)'
                            : 'rgba(255,255,255,0.03)',
                          transition: 'background 0.2s ease',
                        }}
                      >
                        {stageLeads.length === 0 && !snapshot.isDraggingOver && (
                          <div className="text-center py-4">
                            <p className="text-secondary-light text-xs mb-0">
                              No leads
                            </p>
                          </div>
                        )}

                        {stageLeads.map((lead, index) => (
                          <PipelineCard
                            key={lead.id}
                            lead={lead}
                            index={index}
                          />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </>
  );
};

export default PipelineBoard;
