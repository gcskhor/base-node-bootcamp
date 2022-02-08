import { writeFile } from 'fs';
let bumble = process.argv[2];
writeFile('data.json', bumble, (err) => console.error('err ->', err));