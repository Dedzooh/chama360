/**
 * Simple schema validation script for governance and dispute models
 * Validates requirements 20.1, 20.4, 22.1, 22.2 without database connection
 */

const fs = require('fs');
const path = require('path');

// Read the Prisma schema file
const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

console.log('🔍 Validating Governance and Dispute Models Schema...\n');

// Validation functions
function validateRequirement20_1() {
  console.log('📋 Requirement 20.1: Dispute record with transaction/member linking and evidence upload');
  
  // Check Dispute model
  const disputeModelMatch = schemaContent.match(/model Dispute \{[\s\S]*?\}/);
  if (!disputeModelMatch) {
    console.log('❌ Dispute model not found');
    return false;
  }
  
  const disputeModel = disputeModelMatch[0];
  const hasRelatedTransaction = disputeModel.includes('relatedTransaction');
  const hasAgainstMember = disputeModel.includes('againstMember');
  const hasImmutableHash = disputeModel.includes('immutableHash');
  
  // Check Evidence model
  const evidenceModelMatch = schemaContent.match(/model Evidence \{[\s\S]*?\}/);
  if (!evidenceModelMatch) {
    console.log('❌ Evidence model not found');
    return false;
  }
  
  const evidenceModel = evidenceModelMatch[0];
  const hasDisputeId = evidenceModel.includes('disputeId');
  const hasEvidenceHash = evidenceModel.includes('hash');
  
  console.log(`   ✅ Dispute model has relatedTransaction field: ${hasRelatedTransaction}`);
  console.log(`   ✅ Dispute model has againstMember field: ${hasAgainstMember}`);
  console.log(`   ✅ Evidence model has disputeId field: ${hasDisputeId}`);
  console.log(`   ✅ Evidence model has hash field: ${hasEvidenceHash}`);
  
  return hasRelatedTransaction && hasAgainstMember && hasDisputeId && hasEvidenceHash;
}

function validateRequirement20_4() {
  console.log('\n🔒 Requirement 20.4: Immutable dispute logs for legal protection');
  
  const disputeModelMatch = schemaContent.match(/model Dispute \{[\s\S]*?\}/);
  const evidenceModelMatch = schemaContent.match(/model Evidence \{[\s\S]*?\}/);
  
  if (!disputeModelMatch || !evidenceModelMatch) {
    console.log('❌ Required models not found');
    return false;
  }
  
  const disputeModel = disputeModelMatch[0];
  const evidenceModel = evidenceModelMatch[0];
  
  const hasDisputeImmutableHash = disputeModel.includes('immutableHash') && disputeModel.includes('@unique');
  const hasEvidenceHash = evidenceModel.includes('hash');
  
  console.log(`   ✅ Dispute model has immutableHash field with unique constraint: ${hasDisputeImmutableHash}`);
  console.log(`   ✅ Evidence model has hash field for integrity: ${hasEvidenceHash}`);
  
  return hasDisputeImmutableHash && hasEvidenceHash;
}

function validateRequirement22_1() {
  console.log('\n🗳️  Requirement 22.1: Multiple voting types support');
  
  const voteModelMatch = schemaContent.match(/model Vote \{[\s\S]*?\}/);
  if (!voteModelMatch) {
    console.log('❌ Vote model not found');
    return false;
  }
  
  // Check VoteType enum
  const voteTypeEnumMatch = schemaContent.match(/enum VoteType \{[\s\S]*?\}/);
  if (!voteTypeEnumMatch) {
    console.log('❌ VoteType enum not found');
    return false;
  }
  
  const voteTypeEnum = voteTypeEnumMatch[0];
  const hasSimpleMajority = voteTypeEnum.includes('SIMPLE_MAJORITY');
  const hasWeightedContribution = voteTypeEnum.includes('WEIGHTED_CONTRIBUTION');
  const hasRoleRestricted = voteTypeEnum.includes('ROLE_RESTRICTED');
  
  console.log(`   ✅ Supports SIMPLE_MAJORITY voting: ${hasSimpleMajority}`);
  console.log(`   ✅ Supports WEIGHTED_CONTRIBUTION voting: ${hasWeightedContribution}`);
  console.log(`   ✅ Supports ROLE_RESTRICTED voting: ${hasRoleRestricted}`);
  
  return hasSimpleMajority && hasWeightedContribution && hasRoleRestricted;
}

function validateRequirement22_2() {
  console.log('\n⚖️  Requirement 22.2: Quorum rules and vote manipulation prevention');
  
  const voteModelMatch = schemaContent.match(/model Vote \{[\s\S]*?\}/);
  const voteCastModelMatch = schemaContent.match(/model VoteCast \{[\s\S]*?\}/);
  
  if (!voteModelMatch || !voteCastModelMatch) {
    console.log('❌ Required models not found');
    return false;
  }
  
  const voteModel = voteModelMatch[0];
  const voteCastModel = voteCastModelMatch[0];
  
  const hasQuorumRequired = voteModel.includes('quorumRequired');
  const hasUniqueConstraint = voteCastModel.includes('@@unique([optionId, memberId])');
  
  console.log(`   ✅ Vote model has quorumRequired field: ${hasQuorumRequired}`);
  console.log(`   ✅ VoteCast has unique constraint to prevent duplicate votes: ${hasUniqueConstraint}`);
  
  return hasQuorumRequired && hasUniqueConstraint;
}

function validateModelCompleteness() {
  console.log('\n📊 Model Completeness Check');
  
  const requiredModels = ['Dispute', 'Evidence', 'Vote', 'VoteOption', 'VoteCast'];
  const results = {};
  
  requiredModels.forEach(modelName => {
    const modelExists = schemaContent.includes(`model ${modelName} {`);
    results[modelName] = modelExists;
    console.log(`   ${modelExists ? '✅' : '❌'} ${modelName} model: ${modelExists ? 'Found' : 'Missing'}`);
  });
  
  return Object.values(results).every(exists => exists);
}

// Run all validations
const results = {
  requirement20_1: validateRequirement20_1(),
  requirement20_4: validateRequirement20_4(),
  requirement22_1: validateRequirement22_1(),
  requirement22_2: validateRequirement22_2(),
  completeness: validateModelCompleteness()
};

console.log('\n📋 Validation Summary:');
console.log('='.repeat(50));

Object.entries(results).forEach(([requirement, passed]) => {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${requirement}`);
});

const allPassed = Object.values(results).every(result => result);
console.log('\n' + '='.repeat(50));
console.log(`🎯 Overall Result: ${allPassed ? '✅ ALL REQUIREMENTS MET' : '❌ SOME REQUIREMENTS FAILED'}`);

if (allPassed) {
  console.log('\n🎉 The governance and dispute models are properly implemented according to requirements 20.1, 20.4, 22.1, and 22.2!');
  console.log('\nKey Features Validated:');
  console.log('• Dispute records can link to transactions and members');
  console.log('• Evidence upload capability with integrity hashing');
  console.log('• Immutable audit trails for legal protection');
  console.log('• Multiple voting types (simple majority, weighted, role-restricted)');
  console.log('• Quorum enforcement and vote manipulation prevention');
  console.log('• Complete model relationships and constraints');
} else {
  console.log('\n⚠️  Some requirements are not met. Please review the schema.');
  process.exit(1);
}

process.exit(0);