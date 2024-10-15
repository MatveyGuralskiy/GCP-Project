const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');

describe('EJS Views', () => {
    it('should render the index page', async () => {
        const response = await request(app).get('/');
        expect(response.status).toBe(200);
        expect(response.text).toContain('<h1 class="my-4 text-center">Cloud Storage List</h1>'); // Check for a specific element or text
    });

    it('should render the login page', async () => {
        const response = await request(app).get('/login');
        expect(response.status).toBe(200);
        expect(response.text).toContain('<h1 class="my-4 text-center">Login</h1>'); // Check for a specific element or text
    });

    it('should render the register page', async () => {
        const response = await request(app).get('/register');
        expect(response.status).toBe(200);
        expect(response.text).toContain('<h2>Register</h2>'); // Check for a specific element or text
    });

    it('should render the upload page', async () => {
        // Mock a valid JWT token to simulate logged-in user
        const token = jwt.sign({ username: 'testUser' }, 'secret', { expiresIn: '1h' });

        // Simulate a logged-in request by setting the token in the cookie
        const response = await request(app)
            .get('/upload')
            .set('Cookie', `token=${token}`); // Set the token in the request cookie

        expect(response.status).toBe(200);
        expect(response.text).toContain('<h1>Upload File</h1>'); // Match the actual content
    });
});