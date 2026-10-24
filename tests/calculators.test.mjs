import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateDay, estimateActions, parsePounds, planBudget, planGoal, projectContributions } from '../features/planning/calculators.ts';
import { makeSample, sampleAction } from '../preview/sample.ts';
const sample = () => structuredClone(makeSample());

test('budget reconciles future inflows, commitments, allowance and reserve', () => {
  const budget = sample().budget;
  const result = planBudget(budget);
  assert.equal(result.rawHeadroomPence, 12000);
  assert.equal(result.days, 30);
  assert.equal(result.dailyAllowancePence, 1000);
});
test('larger allowance creates a shortfall rather than fictitious savings', () => {
  const budget = sample().budget;
  budget.desiredSpendingAllowancePence = 50000;
  assert.equal(planBudget(budget).shortfallPence, 8000);
  assert.equal(planBudget(budget).potentialGoalAllocationPence, 0);
});
test('future entries only include dates inside planning horizon', () => {
  const budget = sample().budget;
  budget.confirmedInflows = ['2026-10-24','2026-10-25','2026-11-23','2026-11-24']
    .map((date,i)=>({id:String(i),label:'Funding',date,amountPence:100}));
  assert.equal(planBudget(budget).includedInflowsPence, 200);
});
test('future cash deficit prevents projecting an allocation', () => {
  const { budget, goal }=sample();
  budget.accessibleFundsPence=0;
  budget.cashPence=0;
  budget.confirmedInflows[0].amountPence=200000;
  assert.equal(planBudget(budget).firstNegativeDate,'2026-11-01');
  assert.equal(planGoal(goal,budget,[sampleAction]).potentialContributionPence,0);
});
test('unconfirmed inputs prevent goal allocation', () => {
  const {budget,goal}=sample();
  budget.inputsConfirmed=false;
  assert.equal(planGoal(goal,budget).potentialContributionPence,0);
});
test('selected action increases potential balance, never actual saved', () => {
  const {budget,goal}=sample();
  const result=planGoal(goal,budget,[sampleAction]);
  assert.equal(result.actualSavedPence,5000);
  assert.equal(result.potentialActionUpliftPence,2000);
  assert.equal(result.potentialBalancePence,19000);
});
test('duplicate/overlapping action amounts are not double-counted', () => {
  const budget=sample().budget;
  const result=estimateActions([sampleAction,{...sampleAction,id:'alternate',overlapGroup:' synthetic-spending '}],budget);
  assert.equal(result.accepted.length,1);
  assert.equal(result.excluded.length,1);
  assert.equal(result.estimatedSavingPence,2000);
});
test('action savings cannot exceed the existing allowance', () => {
  const budget=sample().budget;
  const result=estimateActions([
    {...sampleAction,estimatedSavingPence:25000},
    {...sampleAction,id:'another',overlapGroup:'other',estimatedSavingPence:25000},
  ],budget);
  assert.equal(result.estimatedSavingPence,30000);
  assert.equal(result.capped,true);
});
test('goal contributions capped at remaining target', () => {
  const {budget,goal}=sample();
  goal.actualSavedPence=29000;
  assert.equal(planGoal(goal,budget,[sampleAction]).potentialBalancePence,30000);
});
test('precise pence conversion rejects invalid numbers', () => {
  assert.equal(parsePounds('12.3'),1230);
  for(const invalid of ['', '-1','1.001','1e3','NaN']) assert.throws(()=>parsePounds(invalid));
});
test('invalid dates rejected; leap date calculation correct', () => {
  assert.equal(dateDay('2028-03-01')-dateDay('2028-02-28'),2);
  assert.throws(()=>dateDay('2026-02-29'));
});
test('10-year investment illustration reference values', () => {
  assert.deepEqual(projectContributions(2500,10).map(x=>x.valuePence),[258946,300000,385908]);
});
test('invalid return and horizon rejected', () => {
  assert.throws(()=>projectContributions(2500,10,[-1]));
  assert.throws(()=>projectContributions(2500,-1));
});
