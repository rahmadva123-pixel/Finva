
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
// import {firebase} from '@genkit-ai/firebase';

export const ai = genkit({
  plugins: [
    // firebase(),
    // googleAI may return a provider type not matching Genkit's plugin V2 typing;
    // cast to any so typecheck passes until plugin typings are updated.
    (googleAI() as unknown) as any,
  ],
  model: 'googleai/gemini-2.0-flash',
});
