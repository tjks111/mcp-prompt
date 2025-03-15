import { PostgresAdapter } from '../../src/adapters.js';

// Skip these tests by default since they require a PostgreSQL database
// To run these tests, ensure PostgreSQL is available with the right credentials
describe.skip('PostgresAdapter Integration', () => {
  let adapter: PostgresAdapter;
  
  beforeEach(async () => {
    // Create a new adapter with test configuration
    adapter = new PostgresAdapter({
      host: 'localhost',
      port: 5432,
      database: 'mcp_prompts_test',
      user: 'postgres',
      password: 'postgres',
      ssl: false
    });
    
    try {
      await adapter.connect();
      
      // Clear existing data
      // @ts-ignore - clearAll method might not be in the type definition but is implemented
      await adapter.clearAll();
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }
  });
  
  it('should be defined', () => {
    expect(PostgresAdapter).toBeDefined();
  });
  
  it('should save and retrieve a prompt', async () => {
    const testPrompt = {
      id: 'pg-test-prompt-1',
      name: 'PG Test Prompt 1',
      description: 'A test prompt for PostgreSQL integration testing',
      content: 'This is a PostgreSQL test prompt content',
      tags: ['test', 'postgres'],
      isTemplate: false,
      variables: [],
      metadata: {
        author: 'Test Author',
        version: '1.0.0'
      }
    };

    await adapter.savePrompt(testPrompt);
    const retrievedPrompt = await adapter.getPrompt('pg-test-prompt-1');
    
    expect(retrievedPrompt).toBeDefined();
    expect(retrievedPrompt?.id).toBe('pg-test-prompt-1');
    expect(retrievedPrompt?.name).toBe('PG Test Prompt 1');
    expect(retrievedPrompt?.content).toBe('This is a PostgreSQL test prompt content');
    expect(retrievedPrompt?.tags).toEqual(['test', 'postgres']);
  });

  it('should update an existing prompt', async () => {
    const testPrompt = {
      id: 'pg-test-prompt-2',
      name: 'PG Test Prompt 2',
      description: 'Original description',
      content: 'Original content',
      tags: ['test'],
      isTemplate: false,
      variables: [],
      metadata: {}
    };

    await adapter.savePrompt(testPrompt);
    
    const updatedPrompt = {
      ...testPrompt,
      description: 'Updated description',
      content: 'Updated content',
      tags: ['test', 'updated']
    };

    await adapter.savePrompt(updatedPrompt);
    
    const retrievedPrompt = await adapter.getPrompt('pg-test-prompt-2');
    
    expect(retrievedPrompt?.description).toBe('Updated description');
    expect(retrievedPrompt?.content).toBe('Updated content');
    expect(retrievedPrompt?.tags).toEqual(['test', 'updated']);
  });

  it('should list prompts with optional filters', async () => {
    const testPrompts = [
      {
        id: 'pg-list-test-1',
        name: 'PG List Test 1',
        description: 'Test prompt 1',
        content: 'Content 1',
        tags: ['test', 'list'],
        isTemplate: false,
        variables: [],
        metadata: {}
      },
      {
        id: 'pg-list-test-2',
        name: 'PG List Test 2',
        description: 'Test prompt 2',
        content: 'Content 2',
        tags: ['test', 'list', 'important'],
        isTemplate: true,
        variables: ['var1', 'var2'],
        metadata: {}
      }
    ];

    for (const prompt of testPrompts) {
      await adapter.savePrompt(prompt);
    }

    const allPrompts = await adapter.listPrompts();
    expect(allPrompts.length).toBeGreaterThanOrEqual(2);
    
    const filteredPrompts = await adapter.listPrompts({ tags: ['important'] });
    expect(filteredPrompts.length).toBeGreaterThanOrEqual(1);
    expect(filteredPrompts.some(p => p.id === 'pg-list-test-2')).toBe(true);
  });

  it('should delete a prompt', async () => {
    const testPrompt = {
      id: 'pg-delete-test',
      name: 'PG Delete Test',
      description: 'A prompt to be deleted',
      content: 'Delete me',
      tags: ['test', 'delete'],
      isTemplate: false,
      variables: [],
      metadata: {}
    };

    await adapter.savePrompt(testPrompt);
    
    // Verify the prompt exists
    const savedPrompt = await adapter.getPrompt('pg-delete-test');
    expect(savedPrompt).toBeDefined();
    
    // Delete the prompt
    await adapter.deletePrompt('pg-delete-test');
    
    // Verify it was deleted
    const deletedPrompt = await adapter.getPrompt('pg-delete-test');
    expect(deletedPrompt).toBeNull();
  });
}); 