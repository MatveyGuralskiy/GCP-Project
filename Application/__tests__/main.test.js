const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
require('dotenv').config(); // Load environment variables

describe('EJS Views', () => {
    it('should render the index page', async () => {
        const response = await request(app).get('/');
        expect(response.status).toBe(200);
        expect(response.text).toContain('<h1 class="my-4 text-center">Cloud Storage List</h1>');
    });

    it('should render the login page', async () => {
        const response = await request(app).get('/login');
        expect(response.status).toBe(200);
        expect(response.text).toContain('<h2>Login</h2>'); // Adjusted expectation
    });

    it('should render the register page', async () => {
        const response = await request(app).get('/register');
        expect(response.status).toBe(200);
        expect(response.text).toContain('<h2>Register</h2>');
    });

    it('should render the upload page', async () => {
        // Use the JWT secret from the .env file
        const token = jwt.sign({ username: 'testUser' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        const response = await request(app)
            .get('/upload')
            .set('Cookie', `token=${token}`);

        expect(response.status).toBe(200);
        expect(response.text).toContain('<h1>Upload File</h1>');
    });
});