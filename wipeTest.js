const test = { jobs: [{ id: 1, stage: 'Slitting' }, { id: 2, stage: 'Cutting' }] };
const slittingWipe = test.jobs.filter(j => j.stage !== 'Slitting');
console.log(slittingWipe);
