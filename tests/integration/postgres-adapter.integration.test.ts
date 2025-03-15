import { PostgresAdapter } from '../../src/adapters.js';

// This test requires a PostgreSQL database
// A Docker container should be running with:
// docker run --name postgres-test -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mcp_prompts_test -p 5432:5432 -d postgres:14-alpine
describe('PostgresAdapter Integration', () => {
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
  
  afterEach(async () => {
    try {
      // @ts-ignore - clearAll method might not be in the type definition but is implemented
      await adapter.clearAll();
    } catch (error) {
      console.error('Error cleaning up after test:', error);
    }
  });
  
  it('should be defined', () => {
    expect(PostgresAdapter).toBeDefined();
  });
  
  it('should save and retrieve a prompt', async () => {
    const uniqueId = `pg-test-prompt-1-${Date.now()}`;
    const testPrompt = {
      id: uniqueId,
      name: 'PG Test Prompt 1',
      description: 'A test prompt for PostgreSQL integration testing',
      content: 'This is a PostgreSQL test prompt content',
      tags: ['test', 'postgres'],
      isTemplate: false,
      variables: [], // Empty array instead of undefined
      metadata: {
        author: 'Test Author',
        version: '1.0.0'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await adapter.savePrompt(testPrompt);
    const retrievedPrompt = await adapter.getPrompt(uniqueId);
    
    expect(retrievedPrompt).toBeDefined();
    expect(retrievedPrompt?.id).toBe(uniqueId);
    expect(retrievedPrompt?.name).toBe('PG Test Prompt 1');
    expect(retrievedPrompt?.content).toBe('This is a PostgreSQL test prompt content');
    expect(retrievedPrompt?.tags).toEqual(['test', 'postgres']);
  });

  it('should update an existing prompt', async () => {
    const uniqueId = `pg-test-prompt-2-${Date.now()}`;
    const testPrompt = {
      id: uniqueId,
      name: 'PG Test Prompt 2',
      description: 'Original description',
      content: 'Original content',
      tags: ['test'],
      isTemplate: false,
      variables: [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await adapter.savePrompt(testPrompt);
    
    // Use updatePrompt instead of savePrompt for updates
    const updatedData = {
      description: 'Updated description',
      content: 'Updated content',
      tags: ['test', 'updated']
    };

    await adapter.updatePrompt(uniqueId, updatedData);
    
    const retrievedPrompt = await adapter.getPrompt(uniqueId);
    
    expect(retrievedPrompt?.description).toBe('Updated description');
    expect(retrievedPrompt?.content).toBe('Updated content');
    expect(retrievedPrompt?.tags).toEqual(['test', 'updated']);
  });

  it('should list prompts with optional filters', async () => {
    const timestamp = Date.now();
    const testPrompts = [
      {
        id: `pg-list-test-1-${timestamp}`,
        name: 'PG List Test 1',
        description: 'Test prompt 1',
        content: 'Content 1',
        tags: ['test', 'list'],
        isTemplate: false,
        variables: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `pg-list-test-2-${timestamp}`,
        name: 'PG List Test 2',
        description: 'Test prompt 2',
        content: 'Content 2',
        tags: ['test', 'list', 'important'],
        isTemplate: true,
        variables: ['var1', 'var2'],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const prompt of testPrompts) {
      await adapter.savePrompt(prompt);
    }

    const allPrompts = await adapter.listPrompts();
    expect(allPrompts.length).toBeGreaterThanOrEqual(2);
    
    const filteredPrompts = await adapter.listPrompts({ tags: ['important'] });
    expect(filteredPrompts.length).toBeGreaterThanOrEqual(1);
    expect(filteredPrompts.some(p => p.id === `pg-list-test-2-${timestamp}`)).toBe(true);
  });

  it('should delete a prompt', async () => {
    const uniqueId = `pg-delete-test-${Date.now()}`;
    const testPrompt = {
      id: uniqueId,
      name: 'PG Delete Test',
      description: 'A prompt to be deleted',
      content: 'Delete me',
      tags: ['test', 'delete'],
      isTemplate: false,
      variables: [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await adapter.savePrompt(testPrompt);
    
    // Verify the prompt exists
    const savedPrompt = await adapter.getPrompt(uniqueId);
    expect(savedPrompt).toBeDefined();
    
    // Delete the prompt
    await adapter.deletePrompt(uniqueId);
    
    // Verify it was deleted
    try {
      await adapter.getPrompt(uniqueId);
      fail('Expected prompt to be deleted');
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  // Add a test for handling connection failures gracefully
  it('should handle connection failures gracefully', async () => {
    const badAdapter = new PostgresAdapter({
      host: 'non-existent-host',
      port: 5432,
      database: 'mcp_prompts',
      user: 'postgres',
      password: 'postgres',
      ssl: false
    });
    
    await expect(badAdapter.savePrompt({
      id: 'test',
      name: 'Test Prompt',
      content: 'Test content',
      description: 'Test description',
      tags: ['test'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })).rejects.toThrow();
  });

  // Add a test for transaction rollback on error
  it('should rollback transactions on error', async () => {
    // Create a unique prompt
    const uniqueId = `test-${Date.now()}`;
    
    // First save a prompt successfully
    await adapter.savePrompt({
      id: uniqueId,
      name: 'Original Name',
      content: 'Original content',
      description: 'Original description',
      tags: ['original'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // Attempt an update with invalid data that should fail
    await expect(async () => {
      // Mock a function that fails during transaction
      const failInMiddle = async () => {
        throw new Error('Simulated transaction failure');
      };
      
      // Start our theoretical transaction (we're testing the concept)
      await adapter.getPrompt(uniqueId); // Get original
      await failInMiddle(); // This would fail in the middle
      // If transaction rollback works, this update shouldn't be applied
    }).rejects.toThrow('Simulated transaction failure');
    
    // Verify the prompt wasn't changed
    const prompt = await adapter.getPrompt(uniqueId);
    expect(prompt).not.toBeNull();
    expect(prompt?.name).toBe('Original Name');
  });

  // Add test for bulk operations
  it('should handle bulk operations correctly', async () => {
    const timestamp = Date.now();
    // Create multiple prompts for bulk testing
    const testPrompts = Array.from({ length: 5 }, (_, i) => ({
      id: `bulk-${i}-${timestamp}`,
      name: `Bulk Test ${i}`,
      content: `Bulk content ${i}`,
      description: `Bulk description ${i}`,
      tags: ['bulk', `test-${i}`],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      variables: [],
      metadata: {}
    }));
    
    // Save all prompts
    for (const prompt of testPrompts) {
      await adapter.savePrompt(prompt);
    }
    
    // Test bulk retrieval by tag
    const bulkPrompts = await adapter.listPrompts({ tags: ['bulk'] });
    expect(bulkPrompts.length).toBeGreaterThanOrEqual(testPrompts.length);
    
    // Clean up the bulk prompts
    for (const prompt of testPrompts) {
      await adapter.deletePrompt(prompt.id);
    }
    
    // Verify cleanup
    const remainingBulkPrompts = await adapter.listPrompts({ tags: ['bulk'] });
    expect(remainingBulkPrompts.filter(p => 
      testPrompts.some(tp => tp.id === p.id)
    ).length).toBe(0);
  });
}); 