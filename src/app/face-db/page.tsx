import { FaceDBView } from '@/components/face-db-view';
import { FACE_RECORDS } from '@/lib/mock-data';

export default function FaceDBPage() {
  return <FaceDBView records={FACE_RECORDS} />;
}
