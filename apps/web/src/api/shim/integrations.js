// Base44 Core integrations -> Supabase equivalents.
//
// InvokeLLM: bridged through the invoke-llm Edge Function so the provider
// key stays server-side. NOTE: this is a transitional bridge that preserves
// the app's current client-composed prompts; per the migration scope these
// call sites are to be converted to named server-side tasks (with tier
// checks and usage logging) — see SCOPE_DRAFTING_HANDOFF.md.
// SendEmail: send-email Edge Function (Resend).
// UploadPublicFile: Supabase Storage "public" bucket.
import { supabase } from './supabase.js';

async function invokeEdge(slug, payload) {
  const { data, error } = await supabase.functions.invoke(slug, { body: payload ?? {} });
  if (error) {
    const err = new Error(error.message || `${slug} failed`);
    err.status = error.context?.status || 500;
    err.data = error;
    throw err;
  }
  return data;
}

const Core = {
  // Base44 InvokeLLM returns the model output directly (an object when
  // response_json_schema is set, otherwise a string).
  InvokeLLM: (params) => invokeEdge('invoke-llm', params),

  SendEmail: (params) => invokeEdge('send-email', params),

  async UploadPublicFile({ file }) {
    const path = `uploads/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from('public').upload(path, file);
    if (error) throw new Error(`Upload failed: ${error.message}`);
    const { data } = supabase.storage.from('public').getPublicUrl(path);
    return { file_url: data.publicUrl };
  },
};

// The export keeps every name the old integrations surface declared;
// unported ones fail loudly instead of silently doing nothing.
const notPorted = (name) => () => {
  throw new Error(`Base44 integration ${name} is not part of the migrated app`);
};

Core.TranscribeAudio = notPorted('TranscribeAudio');
Core.SendPushNotification = notPorted('SendPushNotification');
Core.GenerateImage = notPorted('GenerateImage');
Core.GenerateSpeech = notPorted('GenerateSpeech');
Core.GenerateVideo = notPorted('GenerateVideo');
Core.ExtractDataFromUploadedFile = notPorted('ExtractDataFromUploadedFile');
Core.CreateFileSignedUrl = notPorted('CreateFileSignedUrl');
Core.UploadPrivateFile = notPorted('UploadPrivateFile');
Core.UploadFile = Core.UploadPublicFile;

export const integrations = { Core };
