import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: lectures, error: err1 } = await supabase.from('lectures').select('id, title, module_id, group_id');
  const { data: groups, error: err2 } = await supabase.from('lecture_groups').select('id, title, module_id');
  const { data: modules, error: err3 } = await supabase.from('modules').select('id, title, phase_id');
  
  if (err1 || err2 || err3) {
    console.error(err1, err2, err3);
    return;
  }
  
  const groupMap = new Map(groups.map(g => [g.id, g.module_id]));
  
  let mismatchCount = 0;
  for (const l of lectures) {
    if (l.group_id) {
      const groupModuleId = groupMap.get(l.group_id);
      if (groupModuleId !== l.module_id) {
        console.log(`MISMATCH: Lecture "${l.title}" has module_id=${l.module_id} but its group has module_id=${groupModuleId}`);
        mismatchCount++;
        
        // Let's fix it!
        await supabase.from('lectures').update({ module_id: groupModuleId }).eq('id', l.id);
        console.log('Fixed lecture module_id to match group module_id');
      }
    }
  }
  
  console.log(`Total lectures: ${lectures.length}`);
  console.log(`Total groups: ${groups.length}`);
  console.log(`Mismatches: ${mismatchCount}`);
}

check();
