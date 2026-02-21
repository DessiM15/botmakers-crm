import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireClient } from '@/lib/auth/helpers';
import { getClientProjects } from '@/lib/db/queries/portal';
import { trackPortalLogin } from '@/lib/actions/portal';
import PortalLayout from '@/components/crm/PortalLayout';
import Link from 'next/link';

export const metadata = {
  title: 'Client Portal — Botmakers',
};

export default async function PortalHomePage() {
  const cookieStore = await cookies();
  const { client } = await requireClient(cookieStore);

  // Check if access is revoked
  if (client.portalAccessRevoked) {
    const { createServerSupabaseClient } = await import('@/lib/db/client');
    const supabase = createServerSupabaseClient(cookieStore);
    await supabase.auth.signOut();
    redirect('/portal/login?error=access_revoked');
  }

  // Track login (non-blocking)
  trackPortalLogin(client.id, client.portalFirstLoginAt).catch(() => {});

  // Redirect to onboarding if not completed
  if (!client.portalOnboardingComplete) {
    redirect('/portal/welcome');
  }

  const projects = await getClientProjects(client.id);

  // Auto-redirect if exactly 1 project
  if (projects.length === 1) {
    redirect(`/portal/projects/${projects[0].id}`);
  }

  return (
    <PortalLayout>
      <div className='mb-4'>
        <h4 className='fw-bold mb-1' style={{ color: '#033457' }}>
          Welcome back, {client.fullName.split(' ')[0]}
        </h4>
        <p className='text-muted mb-0'>Your active projects</p>
      </div>

      {projects.length === 0 ? (
        <div className='card border-0 shadow-sm'>
          <div className='card-body text-center py-5'>
            <div className='mb-3' style={{ fontSize: '48px', opacity: 0.3 }}>
              <svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='#033457' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'>
                <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />
                <line x1='3' y1='9' x2='21' y2='9' />
                <line x1='9' y1='21' x2='9' y2='9' />
              </svg>
            </div>
            <h5 className='fw-semibold mb-2' style={{ color: '#033457' }}>
              No active projects
            </h5>
            <p className='text-muted small mb-0'>
              Contact{' '}
              <a href='mailto:info@botmakers.ai' style={{ color: '#033457' }}>
                info@botmakers.ai
              </a>{' '}
              to get started.
            </p>
          </div>
        </div>
      ) : (
        <div className='row g-3'>
          {projects.map((project) => {
            const total = Number(project.totalMilestones);
            const completed = Number(project.completedMilestones);
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <div key={project.id} className='col-md-6'>
                <Link
                  href={`/portal/projects/${project.id}`}
                  className='text-decoration-none'
                >
                  <div className='card border-0 shadow-sm h-100' style={{ cursor: 'pointer', transition: 'transform 0.15s' }}>
                    <div className='card-body'>
                      <h6 className='fw-semibold mb-1' style={{ color: '#033457' }}>
                        {project.name}
                      </h6>
                      <p className='text-muted small mb-3'>
                        {project.projectType || 'Project'} &bull;{' '}
                        {project.status.replace(/_/g, ' ')}
                      </p>

                      <div className='d-flex align-items-center justify-content-between mb-1'>
                        <span className='small fw-medium' style={{ color: '#033457' }}>
                          Progress
                        </span>
                        <span className='small fw-bold' style={{ color: progress === 100 ? '#198754' : '#03FF00' }}>
                          {progress}%
                        </span>
                      </div>
                      <div
                        className='progress'
                        style={{ height: '8px', background: '#e9ecef' }}
                      >
                        <div
                          className='progress-bar'
                          style={{
                            width: `${progress}%`,
                            background: progress === 100 ? '#198754' : '#03FF00',
                            transition: 'width 0.6s ease',
                          }}
                        />
                      </div>
                      <p className='text-muted small mt-2 mb-0'>
                        {completed} of {total} milestones complete
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}
