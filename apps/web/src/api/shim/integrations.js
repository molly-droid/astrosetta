// Base44 Core integrations -> Supabase equivalents.
//
// InvokeLLM: RETIRED on the client. Every former call site now uses a named
// server-side task via @/api/llmTasks (tier checks + usage logging enforced
// in the llm-task Edge Function); the invoke-llm endpoint is service-role
// only. The stub below fails loudly if new code reaches for the old surface.
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
  InvokeLLM: () => {
    throw new Error(
      'Client-side InvokeLLM is retired — use invokeLLMTask(name, params) from @/api/llmTasks (named server-side tasks with tier checks and usage logging)'
    );
  },

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
