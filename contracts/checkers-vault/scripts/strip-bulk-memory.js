#!/usr/bin/env node
/**
 * Strip bulk memory operations (memory.copy, memory.fill) from WAT text format.
 * Replaces them with byte-by-byte loop equivalents using a helper function approach.
 *
 * Usage: node strip-bulk-memory.js input.wat output.wat
 */

const fs = require('fs');

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: node strip-bulk-memory.js input.wat output.wat');
  process.exit(1);
}

let wat = fs.readFileSync(inputPath, 'utf8');

// Count originals
const copyCount = (wat.match(/memory\.copy/g) || []).length;
const fillCount = (wat.match(/memory\.fill/g) || []).length;
console.log(`Found ${copyCount} memory.copy and ${fillCount} memory.fill operations`);

// Replace memory.copy with a call to a helper function $__memory_copy
// memory.copy pops (dest, src, len) from stack
// We'll replace with: call $__memory_copy
wat = wat.replace(/memory\.copy/g, 'call $__memory_copy');

// Replace memory.fill with a call to a helper function $__memory_fill
// memory.fill pops (dest, val, len) from stack
wat = wat.replace(/memory\.fill/g, 'call $__memory_fill');

// Now inject the helper functions right after the first (func declaration
// We need to find the right place to insert - after type/import/memory/table declarations
// but before the first function

// Insert helper functions. We'll add them as the first functions in the module.
// Find the position of the first (func to insert before it.
const firstFuncMatch = wat.match(/\n(\s*)\(func /);
if (!firstFuncMatch) {
  console.error('Could not find first (func in WAT');
  process.exit(1);
}

const insertPos = wat.indexOf(firstFuncMatch[0]);
const indent = firstFuncMatch[1];

const helperFunctions = `
${indent};; Helper: memory.copy replacement (byte-by-byte copy, handles overlapping)
${indent}(func $__memory_copy (param $dest i32) (param $src i32) (param $len i32)
${indent}  (local $i i32)
${indent}  (if (i32.lt_u (local.get $dest) (local.get $src))
${indent}    (then
${indent}      ;; Forward copy (dest < src)
${indent}      (local.set $i (i32.const 0))
${indent}      (block $break
${indent}        (loop $loop
${indent}          (br_if $break (i32.ge_u (local.get $i) (local.get $len)))
${indent}          (i32.store8
${indent}            (i32.add (local.get $dest) (local.get $i))
${indent}            (i32.load8_u (i32.add (local.get $src) (local.get $i)))
${indent}          )
${indent}          (local.set $i (i32.add (local.get $i) (i32.const 1)))
${indent}          (br $loop)
${indent}        )
${indent}      )
${indent}    )
${indent}    (else
${indent}      ;; Backward copy (dest >= src, handles overlap)
${indent}      (local.set $i (local.get $len))
${indent}      (block $break
${indent}        (loop $loop
${indent}          (br_if $break (i32.eqz (local.get $i)))
${indent}          (local.set $i (i32.sub (local.get $i) (i32.const 1)))
${indent}          (i32.store8
${indent}            (i32.add (local.get $dest) (local.get $i))
${indent}            (i32.load8_u (i32.add (local.get $src) (local.get $i)))
${indent}          )
${indent}          (br $loop)
${indent}        )
${indent}      )
${indent}    )
${indent}  )
${indent})
${indent};; Helper: memory.fill replacement (byte-by-byte fill)
${indent}(func $__memory_fill (param $dest i32) (param $val i32) (param $len i32)
${indent}  (local $i i32)
${indent}  (local.set $i (i32.const 0))
${indent}  (block $break
${indent}    (loop $loop
${indent}      (br_if $break (i32.ge_u (local.get $i) (local.get $len)))
${indent}      (i32.store8
${indent}        (i32.add (local.get $dest) (local.get $i))
${indent}        (local.get $val)
${indent}      )
${indent}      (local.set $i (i32.add (local.get $i) (i32.const 1)))
${indent}      (br $loop)
${indent}    )
${indent}  )
${indent})
`;

wat = wat.slice(0, insertPos) + helperFunctions + wat.slice(insertPos);

// Also need to add the function types for the helpers
// They use (param i32 i32 i32) with no result - type should already exist

// Remove the target_features custom section (bare string at module end)
// It appears as a line like:   "\08+\0bbulk-memory..." right before the closing )
// Remove lines that contain the target_features encoding
const lines = wat.split('\n');
const filteredLines = lines.filter(line => {
  // Remove the bare target_features string line (contains bulk-memory marker)
  if (line.includes('bulk-memory') && line.trim().startsWith('"')) return false;
  // Also remove @custom target_features if present
  if (line.includes('@custom') && line.includes('target_features')) return false;
  return true;
});
wat = filteredLines.join('\n');

fs.writeFileSync(outputPath, wat);
console.log(`Written to ${outputPath}`);

// Verify no bulk memory ops remain
const remaining = (wat.match(/memory\.copy|memory\.fill/g) || []).length;
console.log(`Remaining bulk memory ops: ${remaining}`);
