const mode = $('Prompt Builder').first().json.mode; 
const solarContent = $('Solar LLM').first().json.choices[0].message.content;
const tableCount = $('Prompt Builder').first().json.tableCount;
const imageCount = $('Prompt Builder').first().json.imageCount;

const cleanResult = solarContent.replace(/```/g, "").trim();

return {
  success: true,
  summary_text: cleanResult,
  table_count: tableCount,
  image_count: imageCount,
  mode: mode
};
