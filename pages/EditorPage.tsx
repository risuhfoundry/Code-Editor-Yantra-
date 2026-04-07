import EditorWorkspace from './EditorWorkspace';
import { defaultStudentProfile } from '@/src/features/dashboard/student-profile-model';
import { buildLocalEditorProject } from '@/editor/lib/local-dev-projects';
import { requireAuthenticatedProfile } from '@/src/lib/supabase/route-guards';

type EditorPageProps = {
  searchParams?: Promise<{
    projectId?: string | string[];
  }>;
};

function resolveProjectId(projectId: string | string[] | undefined) {
  if (Array.isArray(projectId)) {
    return projectId[0] ?? null;
  }

  return projectId ?? null;
}

export default async function EditorPage({ searchParams }: EditorPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const initialProjectId = resolveProjectId(params?.projectId);

  if (process.env.NODE_ENV !== 'production') {
    const initialProjectDetails =
      initialProjectId === null
        ? buildLocalEditorProject({
            projectId: 'local-dev-python-playground',
            userId: 'local-dev-user',
            templateKey: 'python-playground',
            timestamp: '2026-04-06T00:00:00.000Z',
          })
        : null;

    return (
      <EditorWorkspace
        authedUser={{
          id: 'local-dev-user',
          email: 'local-dev@yantra.test',
        }}
        profile={defaultStudentProfile}
        initialProjectId={initialProjectId ?? initialProjectDetails?.project.id ?? null}
        initialProjectDetails={initialProjectDetails}
        devBypass
      />
    );
  }

  const result = await requireAuthenticatedProfile({
    unauthenticatedRedirect: '/login?message=Log%20in%20to%20open%20the%20Yantra%20Editor.&kind=info',
  });

  return (
    <EditorWorkspace
      authedUser={{
        id: result.user.id,
        email: result.user.email ?? null,
      }}
      profile={result.profile}
      initialProjectId={initialProjectId}
    />
  );
}
