import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { requireClient } from '@/lib/auth/helpers';
import { getPortalProject } from '@/lib/db/queries/portal';
import PortalLayout from '@/components/crm/PortalLayout';
import PortalProgressBar from '@/components/crm/PortalProgressBar';
import PortalMilestones from '@/components/crm/PortalMilestones';
import PortalDemoGallery from '@/components/crm/PortalDemoGallery';
import PortalQuestionForm from '@/components/crm/PortalQuestionForm';

export async function generateMetadata({ params }) {
  return { title: 'Project — Botmakers Portal' };
}

export default async function PortalProjectPage({ params }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const { client } = await requireClient(cookieStore);
  const project = await getPortalProject(id, client.id);

  if (!project) notFound();

  return (
    <PortalLayout>
      <div className='mb-4'>
        <h4 className='fw-bold mb-1' style={{ color: '#033457' }}>
          {project.name}
        </h4>
        <p className='text-muted small mb-0'>
          {project.projectType || 'Project'} &bull;{' '}
          {project.status.replace(/_/g, ' ')}
        </p>
      </div>

      {/* Progress Bar */}
      <PortalProgressBar
        progress={project.progress}
        completed={project.completedMilestones}
        total={project.totalMilestones}
      />

      {/* What's Next */}
      {project.upcomingMilestones.length > 0 && (
        <div className='card border-0 shadow-sm mb-4'>
          <div className='card-body'>
            <h6 className='fw-semibold mb-3' style={{ color: '#033457' }}>
              What's Next
            </h6>
            <div className='d-flex flex-column gap-2'>
              {project.upcomingMilestones.map((m, i) => (
                <div
                  key={m.id}
                  className='d-flex align-items-center gap-3 p-2 rounded'
                  style={{ background: i === 0 ? '#033457' + '0a' : 'transparent' }}
                >
                  <div
                    className='d-flex align-items-center justify-content-center rounded-circle flex-shrink-0'
                    style={{
                      width: 28,
                      height: 28,
                      background: m.status === 'in_progress' ? '#03FF00' : '#e9ecef',
                      color: m.status === 'in_progress' ? '#033457' : '#6c757d',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <span className='small fw-medium' style={{ color: '#033457' }}>
                      {m.title}
                    </span>
                    {m.dueDate && (
                      <span className='text-muted small ms-2'>
                        — due {new Date(m.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Milestones */}
      <PortalMilestones phases={project.phases} />

      {/* Demo Gallery */}
      {project.demos.length > 0 && (
        <PortalDemoGallery demos={project.demos} />
      )}

      {/* Q&A */}
      <PortalQuestionForm
        projectId={project.id}
        questions={project.questions}
      />
    </PortalLayout>
  );
}
