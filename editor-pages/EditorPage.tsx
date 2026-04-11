import EditorWorkspace from './EditorWorkspace';
import { defaultStudentProfile } from '@/src/features/dashboard/student-profile-model';
import { PUBLIC_EDITOR_USER } from '@/src/lib/public-mode';

type EditorPageProps = {
  searchParams?: Promise<{
    projectId?: string | string[];
    session?: string | string[];
  }>;
};

function resolveSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function EditorPage({ searchParams }: EditorPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const initialProjectId = resolveSearchParam(params?.projectId);
  const initialCollaborationSessionId = resolveSearchParam(params?.session);

  return (
    <EditorWorkspace
      authedUser={PUBLIC_EDITOR_USER}
      profile={defaultStudentProfile}
      initialProjectId={initialProjectId}
      initialCollaborationSessionId={initialCollaborationSessionId}
      initialProjectDetails={null}
      devBypass
    />
  );
}
