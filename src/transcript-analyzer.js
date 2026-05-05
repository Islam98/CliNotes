/**
 * Analyzes a given transcript (markdown or raw text) and extracts medical terms, 
 * diagnoses, action items, and other important information.
 *
 * @param {string} transcriptText - The raw or markdown transcript text to analyze.
 * @returns {Promise<Object>} An object containing the extracted structured information.
 */
export async function analyzeTranscript(transcriptText) {
  try {
    const response = await fetch('http://localhost:3000/api/analyze-transcript', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transcriptText })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze transcript');
    }

    return await response.json();
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw error;
  }
}
